import { HEX_COLOR_REGEX, POSSIBLE_MAC_CHARACTERS } from "./constants";
import os from "os";

export const sleep = (ms: number) =>
	new Promise<void>(resolve => setTimeout(resolve, ms));

export const getRandomMac = () =>
	[...Array(12).keys()]
		.map(() =>
			POSSIBLE_MAC_CHARACTERS.charAt(
				Math.floor(Math.random() * POSSIBLE_MAC_CHARACTERS.length),
			),
		)
		.join("");

export const hexToRgb = (hex: `#${string}`) => {
	const result = HEX_COLOR_REGEX.exec(hex);

	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16),
		  }
		: new Error("Invalid hex");
};

export const ipAddress = (networkInterface?: string) => {
	const nets = os.networkInterfaces();

	for (const name of Object.keys(nets)) {
		for (const net of nets[name] ?? []) {
			// Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
			// on node <= v17, 'net.family' is "IPv4"
			// since node v18, it's the number 4 or 6
			const ipv4 = typeof net.family === "string" ? "IPv4" : 4;
			if (net.family === ipv4 && !net.internal) {
				if (networkInterface) {
					if (name == networkInterface) return net.address;
				} else return net.address;
			}
		}
	}

	return undefined;
};

export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
