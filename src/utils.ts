import { HEX_COLOR_REGEX, POSSIBLE_MAC_CHARACTERS } from "./constants";
import { NetworkInfo } from "react-native-network-info";

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

export const ipAddress = async () => {
	try {
		return await NetworkInfo.getIPV4Address();
	} catch {}
	return undefined;
};

export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
