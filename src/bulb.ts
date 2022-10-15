import dgram from "dgram";
import EventEmitter from "events";
import {
	DEFAULT_RESPONSE_WAIT_MS,
	SCENES,
	UDP_BROADCAST_LISTEN_PORT as WIZ_BROADCAST_PORT,
	WIZ_BULB_LISTEN_PORT,
} from "./constants";
import { checkType } from "./type-checker";
import {
	getPilotResponseTemplate,
	GetPilotResponse,
	Message,
	Pilot,
	GetSceneArgs,
	GenericResponse,
	syncPilotResponseTemplate,
	SyncPilotAckMsg,
	setPilotResponseTemplate,
	SyncPilotResponse,
} from "./types";
import { getRandomMac, hexToRgb, ipAddress } from "./utils";
import { WikariError, WikariErrorCode } from "./wikari-error";

export const enum WikariState {
	IDLE,
	BINDING,
	READY,
	CLOSED,
	AWAITING_RESPONSE,
}

/**
 * Allows you to interact with a bulb.
 *
 * Note that upon creation, it will have the state {@link WikariState.IDLE}.
 * When the first instance of {@link Bulb} is created, it will try to bind
 * to the port that WiZ bulbs broadcast updates to, and will set it's state
 * to {@link WikariState.BINDING} while this happens.
 *
 * Once it's done, this instance along with all future instances are ready
 * for communication with the bulb, and the state is set to
 * {@link WikariState.READY}.
 *
 * Whenever the state of the instance changes, it will emit a "state-change"
 * event on {@link Bulb.stateEmitter} with the new state as the argument.
 *
 * Every bulb instance uses the same {@link dgram.Socket} object since each
 * bulb instance requires updates from the same port, we can only bind one
 * socket to the port.
 */
export class Bulb {
	static readonly stateEmitter = new EventEmitter();
	static client = dgram.createSocket("udp4");

	private static _state = WikariState.IDLE;
	static get state() {
		return this._state;
	}

	responseTimeout: number | undefined;
	listenPort: number;
	bulbPort: number;

	readonly macIdentifier: string;
	readonly address: string;

	constructor(
		address: string,
		options: {
			port?: number;
			listenPort?: number;
			responseTimeout?: number;
			macIdentifier?: string;
		},
	) {
		this.address = address;
		this.bulbPort = options.port ?? WIZ_BULB_LISTEN_PORT;
		this.listenPort = options.listenPort ?? WIZ_BROADCAST_PORT;
		this.macIdentifier = options.macIdentifier ?? getRandomMac();
		if (options.responseTimeout) this.responseTimeout = options.responseTimeout;

		if (Bulb.state == WikariState.IDLE) this.initClient();
	}

	static setInstanceState(state: WikariState) {
		this._state = state;
		this.stateEmitter.emit("state-change", state);
	}

	// #######################################################
	//   High-level end-user oriented interaction functions
	// #######################################################

	/**
	 * Calls the given function with the newly received
	 * message as the argument.
	 * @param fn callback for when a message is received
	 */
	onMessage(fn: (msg: Message) => void) {
		Bulb.client.on("message", (bulbMsg, rinfo) => {
			if (rinfo.address != this.address) return;
			try {
				const msg: Message = JSON.parse(bulbMsg.toString());
				fn(msg);
			} catch {}
		});
	}

	/**
	 * After calling {@link this.subscribe}, the bulb will send
	 * updates about it's state every 5 seconds. The provided
	 * callback will be called whenever it does so.
	 * @param fn callback for when a syncPilot message is received
	 */
	onSync(fn: (msg: SyncPilotResponse) => void) {
		Bulb.client.on("message", (bulbMsg, rinfo) => {
			if (rinfo.address != this.address) return;
			try {
				const msg: Message = JSON.parse(bulbMsg.toString());
				if (checkType(syncPilotResponseTemplate, msg)) fn(msg);
			} catch {}
		});
	}

	/**
	 * Sends a subscription message to the bulb, which tells it to send us updates
	 * about it's state every 5 seconds. You can intercept these updates with the
	 * {@link this.onSync} function.
	 *
	 * @param networkInterface network interface connected to the network the bulb is on
	 * @returns subscription message response on success, else a {@link WikariError}
	 */
	async subscribe(networkInterface?: string) {
		const listenIp = ipAddress(networkInterface);
		if (!listenIp)
			throw new Error(
				`Unable to obtain the local IP address ${
					networkInterface
						? ` for the network interface '${networkInterface}'`
						: ""
				}`,
			);

		// Sends a subscription message to the bulb
		// It will now notify us about status changes
		const result = await this.sendRaw({
			method: "registration",
			id: Math.floor(10_000 * Math.random()) + 1,
			version: 1,
			params: {
				register: true,
				phoneIp: listenIp,
				phoneMac: this.macIdentifier,
			},
		});

		if (!(result instanceof WikariError)) {
			Bulb.client.addListener("message", msg => {
				try {
					const response = JSON.parse(msg.toString());

					// if we get a syncPilot message, we send back an
					// acknowledgement for it, which tells WiZ we are
					// still interested in it's status updates
					if (checkType(syncPilotResponseTemplate, response)) {
						this.sendRaw(
							{
								method: "syncPilot",
								id: response.id,
								env: response.env,
								result: {
									mac: this.macIdentifier,
								},
							} as SyncPilotAckMsg,
							false,
						);
					}
				} catch {}
			});
		}

		return result;
	}

	/**
	 * Turns the bulb on or off
	 *
	 * @example
	 * ```ts
	 * // turn on the bulb
	 * await bulb.state(true);
	 *
	 * // turn off the bulb
	 * await bulb.state(false);
	 * ```
	 *
	 * @param state new state of the bulb
	 * @returns response from the bulb on success, {@link WikariError} otherwise
	 */
	async turn(state: boolean) {
		return await this.setPilot({
			state,
		});
	}

	/**
	 * Turns the bulb on if it was off, and vice-versa.
	 * @returns response from the bulb on success, {@link WikariError} otherwise
	 */
	async toggle() {
		const pilot = await this.getPilot();
		if (pilot instanceof WikariError) return pilot;

		return this.setPilot({ state: !pilot.result.state });
	}

	/**
	 * Allows you to change the scene. If you're not familiar with the
	 * numerical scene IDs of the bulb, you can use the {@link SCENES}
	 * object to determine it.
	 *
	 * ```ts
	 * bulb.setScene(SCENES["Christmas"], { speed: 30, dimming: 25 })
	 * ```
	 *
	 * Note that the second argument is strongly typed, and will not let
	 * you set speed or dimming on scenes that do not support them.
	 *
	 * @param sceneId scene ID from 1 to 32 (both inclusive)
	 * @param args arguments associated with @param sceneId
	 * @returns response from the bulb on success, {@link WikariError} otherwise
	 */
	async scene<T extends number>(sceneId: T, args: GetSceneArgs<T> = {}) {
		if (sceneId < 1 || sceneId > 32)
			return new WikariError(
				WikariErrorCode.ArgumentOutOfRange,
				{
					argument: "sceneId",
					lowerLimit: 1,
					higherLimit: 32,
					provided: sceneId,
				},
				"Scene ID must be in the range 1 <> 32",
			);

		for (const [key, value] of Object.entries(args)) {
			if (key == "speed" || key == "dimming") {
				const v = value as number;
				if (v < 1 || v > 100)
					return new WikariError(
						WikariErrorCode.ArgumentOutOfRange,
						{
							argument: key,
							lowerLimit: 1,
							higherLimit: 100,
							provided: v,
						},
						`Optional argument ${key} must be in the range 1 <> 100`,
					);
			}
		}

		return await this.setPilot({
			sceneId,
			...args,
		});
	}

	async brightness(brightness: number) {
		if (brightness < 0 || brightness > 100)
			return new WikariError(
				WikariErrorCode.ArgumentOutOfRange,
				{
					argument: "brightness",
					lowerLimit: 0,
					higherLimit: 100,
					provided: brightness,
				},
				"Brightness must be in the range 0-100",
			);

		return await this.setPilot({ dimming: brightness });
	}

	/**
	 * Changes the color to a certain temperature of white.
	 * ```ts
	 * bulb.white(5000);
	 * ```
	 * @param temp temperature, range 1000 to 10_000 (both inclusive)
	 * @returns response from the bulb on success, {@link WikariError} otherwise
	 */
	async white(temp: number): Promise<GenericResponse> {
		if (temp < 1000 || temp > 10_000)
			throw new WikariError(
				WikariErrorCode.ArgumentOutOfRange,
				{
					argument: "temp",
					lowerLimit: 1000,
					higherLimit: 10_000,
					provided: temp,
				},
				"Temperature must be in the range 1000 <> 10_000",
			);

		return await this.setPilot({
			temp,
		});
	}

	/**
	 * Sets the bulb to a certain color.
	 *
	 * ```ts
	 * // set the bulb to red color
	 * await bulb.color("#f44336");
	 *
	 * // set the bulb to some red and some warm white
	 * await bulb.color({ r: 100, w: 50 });
	 * ```
	 *
	 * Here, c is the cool white component and w is the warm white
	 * component.
	 *
	 * When passing an object, each value must be in the range 0-255
	 * (both inclusive).
	 *
	 * @param color a hex color code, or an rgbcw object
	 * @returns response from the bulb on success, {@link WikariError} otherwise
	 */
	async color(
		color:
			| { r?: number; g?: number; b?: number; c?: number; w?: number }
			| `#${string}`,
	): Promise<GenericResponse> {
		if (typeof color == "string") {
			const rgbColor = hexToRgb(color);
			if (rgbColor instanceof Error) throw rgbColor;

			return await this.setPilot(rgbColor);
		} else {
			for (const [key, value] of Object.entries(color)) {
				if (value < 0 || value > 255) {
					throw new WikariError(
						WikariErrorCode.ArgumentOutOfRange,
						{
							argument: key,
							lowerLimit: 0,
							higherLimit: 255,
							provided: value,
						},
						`'${key}' must be in the range 0 <> 255`,
					);
				}
			}

			return await this.setPilot(color);
		}
	}

	// ######################################
	//   Lower-level interaction functions
	// ######################################
	private isReadyToSend(
		waitForResponse: boolean,
	): WikariError<WikariErrorCode.InvalidBulbState> | undefined {
		const getError = (msg: string) => {
			return new WikariError(
				WikariErrorCode.InvalidBulbState,
				{
					state: Bulb.state,
					expectedState: [WikariState.READY],
				},
				msg,
			);
		};

		if (Bulb.state != WikariState.READY) {
			if (Bulb.state == WikariState.BINDING)
				return getError("Still waiting for port binding to finish");

			if (Bulb.state == WikariState.CLOSED)
				return getError("This bulb instance has been closed");

			if (Bulb.state == WikariState.AWAITING_RESPONSE && waitForResponse)
				return getError("Already waiting on a response");
		}
	}

	private sendWithWait(message: Message): Promise<GenericResponse> {
		Bulb.setInstanceState(WikariState.AWAITING_RESPONSE);

		return new Promise((resolve, reject) => {
			let timer: ReturnType<typeof setTimeout>;

			const messageListener = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
				// if the message is not from the bulb IP, ignore it
				if (rinfo.address != this.address) return;

				try {
					const response = JSON.parse(msg.toString());

					if ("method" in response) {
						// not the response to the request we sent
						if (response["method"] != message["method"]) return;
					}

					if (timer) clearTimeout(timer);
					Bulb.client.off("message", messageListener);

					if ("error" in response) {
						reject(
							new WikariError(
								WikariErrorCode.BulbReturnedFailure,
								{ response },
								"Bulb returned failure",
							),
						);
					} else resolve(response);

					Bulb.setInstanceState(WikariState.READY);
				} catch (error) {
					reject(
						new WikariError(
							WikariErrorCode.ResponseParseFailed,
							{ response: msg.toString(), error: error as Error },
							"Failed to parse response JSON",
						),
					);
				}
			};
			Bulb.client.on("message", messageListener);

			Bulb.client.send(
				JSON.stringify(message),
				this.bulbPort,
				this.address,
				error => {
					if (error) {
						if (timer) clearTimeout(timer);
						Bulb.setInstanceState(WikariState.READY);
						reject(
							new WikariError(
								WikariErrorCode.RequestSendError,
								{ error },
								"Failed to send request to bulb",
							),
						);
					}
				},
			);

			// if the request takes longer than the timeout wait,
			// we can assume the packet has been lost
			const getResponseTimeout = () =>
				this.responseTimeout ?? DEFAULT_RESPONSE_WAIT_MS;

			timer = setTimeout(() => {
				Bulb.client.off("message", messageListener);
				reject(
					new WikariError(
						WikariErrorCode.RequestTimedOut,
						{
							responseWaitMs: getResponseTimeout(),
						},
						"Timed out",
					),
				);
			}, getResponseTimeout());
		});
	}

	private sendWithoutWaiting(message: Message): Promise<GenericResponse> {
		// if we're not waiting for a response, we can just wait to see
		// if there's no errors in the error callback
		return new Promise((resolve, reject) => {
			Bulb.client.send(
				JSON.stringify(message),
				this.bulbPort,
				this.address,
				error => {
					if (error)
						reject(
							new WikariError(
								WikariErrorCode.RequestSendError,
								{ error },
								"Failed to send request to bulb",
							),
						);
					else resolve(message as GenericResponse);
				},
			);
		});
	}

	/**
	 * If you want more control over the sent messages, you can
	 * use this function. All the higher-level bulb control
	 * functions (like {@link Bulb.toggle} or {@link Bulb.color})
	 * internally use this function.
	 *
	 * @param message the message to send to the bulb
	 * @param waitForResponse whether to wait for a response
	 * @returns if waitForResponse is true, the response from the
	 * bulb, otherwise the message to be sent itself
	 */
	async sendRaw(
		message: Message,
		waitForResponse = true,
	): Promise<GenericResponse> {
		const error = this.isReadyToSend(waitForResponse);
		if (error) throw error;

		if (waitForResponse) {
			return this.sendWithWait(message);
		} else {
			return this.sendWithoutWaiting(message);
		}
	}

	/**
	 * Fetches the current pilot/state from the bulb.
	 * @returns the bulb pilot response
	 */
	async getPilot(): Promise<GetPilotResponse> {
		const pilot = await this.sendRaw({ method: "getPilot", params: {} });

		if (checkType(getPilotResponseTemplate, pilot)) return pilot;
		else
			throw new WikariError(
				WikariErrorCode.ResponseValidationFailed,
				{ response: pilot },
				"Response validation failed",
			);
	}

	/**
	 * Sets the bulb pilot/state.
	 *
	 * This is a low level function to be used if you want more
	 * control. You should usually find the higher-level
	 * functions (such as {@link Bulb.color}) enough.
	 *
	 * @returns the bulb pilot response
	 */
	async setPilot(pilot: Pilot): Promise<GenericResponse> {
		const response = await this.sendRaw({ method: "setPilot", params: pilot });

		if (checkType(setPilotResponseTemplate, response)) return response;
		else
			throw new WikariError(
				WikariErrorCode.ResponseValidationFailed,
				{ response },
				"Response validation failed",
			);
	}

	// ##################################
	//   UDP Client related functions
	// ##################################
	private async initClient(): Promise<void> {
		Bulb.setInstanceState(WikariState.BINDING);
		return new Promise<void>((resolve, reject) => {
			const listeningCallback = () => {
				Bulb.setInstanceState(WikariState.READY);
				resolve();
			};
			Bulb.client.on("listening", listeningCallback);

			const errorCallback = (error: Error) => {
				Bulb.client.off("listening", listeningCallback);
				reject(
					new WikariError(
						WikariErrorCode.SocketBindFailed,
						{ error },
						`Failed to bind to port ${this.listenPort}`,
					),
				);
			};
			Bulb.client.on("error", errorCallback);

			Bulb.client.bind(this.listenPort, undefined, () => {
				Bulb.client.off("listening", listeningCallback);
				Bulb.client.off("error", errorCallback);
			});
		});
	}

	closeConnection() {
		if (Bulb.state == WikariState.CLOSED) return;
		Bulb.setInstanceState(WikariState.CLOSED);
		Bulb.stateEmitter.removeAllListeners();
		Bulb.client.removeAllListeners();
		Bulb.client.close();
	}
}
