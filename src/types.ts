import {
	ADJUSTABLE_DIMMING_SCENES,
	ADJUSTABLE_SPEED_SCENES,
} from "./constants";
import { FromTypeTemplate, makeTypeTemplate } from "./type-checker";

export const pilotTemplate = makeTypeTemplate({
	// range 1-32
	sceneId: ["number", false],
	// range 1-100, is a percentage
	speed: ["number", false],
	// range 1-100, is a percentage
	dimming: ["number", false],
	// range 1000-10_000, kelvin
	temp: ["number", false],
	// range 0-255
	r: ["number", false],
	// range 0-255
	g: ["number", false],
	// range 0-255
	b: ["number", false],
	// range 0-255
	c: ["number", false],
	// range 0-255
	w: ["number", false],
	// whether the bulb is on or off
	state: ["boolean", false],
});
export type Pilot = FromTypeTemplate<typeof pilotTemplate>;

type IfExtends<P, Q, R extends Pilot> = P extends Q ? R : {};
export type GetSceneArgs<Scene extends number> = IfExtends<
	Scene,
	typeof ADJUSTABLE_SPEED_SCENES[number],
	{ speed?: number }
> &
	IfExtends<
		Scene,
		typeof ADJUSTABLE_DIMMING_SCENES[number],
		{ dimming?: number }
	>;

// #############
//   Responses
// #############
export type GenericResponse = { method: string; params: Record<string, any> };

// getPilot
export const getPilotResponseTemplate = makeTypeTemplate({
	method: ["string", true],
	env: ["string", true],
	result: {
		mac: ["string", true],
		rssi: ["number", true],
		src: ["string", true],
		state: ["boolean", true],
		sceneId: ["number", true],
		// optional properties
		temp: ["number", false],
		speed: ["number", false],
		r: ["number", false],
		g: ["number", false],
		b: ["number", false],
		c: ["number", false],
		w: ["number", false],
		dimming: ["number", false],
	},
});

export type GetPilotResponse = FromTypeTemplate<
	typeof getPilotResponseTemplate
>;

// setPilot
export const setPilotResponseTemplate = makeTypeTemplate({
	method: ["string", true],
	env: ["string", true],
	result: {
		success: ["boolean", true],
	},
});

export type SetPilotType = FromTypeTemplate<typeof setPilotResponseTemplate>;

// syncPilot
export const syncPilotResponseTemplate = makeTypeTemplate({
	method: ["string", true],
	env: ["string", true],
	id: ["number", false],
	params: {
		mac: ["string", true],
		rssi: ["number", true],
		src: ["string", true],
		mqttCd: ["number", false],
		ts: ["number", false],
		...pilotTemplate,
	},
});

export type SyncPilotResponse = FromTypeTemplate<
	typeof syncPilotResponseTemplate
>;

// ##########################
//   Messages Sent To Bulb
// ##########################
export interface GenericMsg {
	method: string;
	params: Record<any, any>;
}

export interface SetPilotMsg extends GenericMsg {
	method: "setPilot";
	params: Pilot;
}

export interface GetPilotMsg extends GenericMsg {
	method: "getPilot";
	params: {};
}

export type SyncPilotMsg = SyncPilotResponse;

export interface SyncPilotAckMsg {
	method: "syncPilot";
	id?: number;
	env: string;
	result: {
		mac: string;
	};
}

export interface RegistrationMsg extends GenericMsg {
	method: "registration";
	id: number;
	version: number;
	params: {
		register: boolean;
		phoneIp: string;
		phoneMac: string;
	};
}

export type Message =
	| SetPilotMsg
	| GetPilotMsg
	| SyncPilotMsg
	| SyncPilotAckMsg
	| RegistrationMsg
	| GenericMsg;
