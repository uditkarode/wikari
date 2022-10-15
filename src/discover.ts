import dgram from "dgram";
import { Bulb } from "./bulb";
import { DEFAULT_DISCOVER_WAIT_MS, WIZ_BULB_LISTEN_PORT } from "./constants";
import { checkType } from "./type-checker";
import { GetPilotMsg, getPilotResponseTemplate } from "./types";
import { sleep } from "./utils";

/**
 * Discovers bulbs on a network.
 * This is done by sending a request and creating bulb instances from the devices
 * that respond.
 *
 * The first argument contains options for discovery, them being:
 * * addr: the address to send the request on (ideally a broadcast address)
 * * port: the port that the bulbs listen on
 * * waitMs: how long to wait for a response from the bulb
 *
 * If your local IP addresses do not start with 192.168.1, you'll need to
 * pass a custom addr.
 *
 * @returns an array of {@link Bulb} instances corresponding to discovered bulbs
 */
export async function discover({
	addr = "192.168.1.255",
	port = WIZ_BULB_LISTEN_PORT,
	waitMs = DEFAULT_DISCOVER_WAIT_MS,
}): Promise<Bulb[]> {
	const client = dgram.createSocket("udp4");
	const bulbs: Bulb[] = [];
	const message: GetPilotMsg = {
		method: "getPilot",
		params: {},
	};

	if (addr.split(".").includes("255")) {
		client.once("listening", function () {
			client.setBroadcast(true);
		});
	}

	client.send(JSON.stringify(message), port, addr);

	const listener = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
		const response = JSON.parse(msg.toString());

		if (checkType(getPilotResponseTemplate, response)) {
			bulbs.push(new Bulb(rinfo.address, { port }));
		}
	};

	client.on("message", listener);
	await sleep(waitMs);
	client.off("message", listener);

	client.close();

	return bulbs;
}
