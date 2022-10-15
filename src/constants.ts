// times
export const DEFAULT_DISCOVER_WAIT_MS = 1000;
export const DEFAULT_RESPONSE_WAIT_MS = 2000;

// ports
export const WIZ_BULB_LISTEN_PORT = 38899;
export const UDP_BROADCAST_LISTEN_PORT = 38900;

// miscellaneous
export const HEX_COLOR_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
export const POSSIBLE_MAC_CHARACTERS = "0123456789abcdef";

// scene info
export const SCENES = {
	"Ocean": 1,
	"Romance": 2,
	"Sunset": 3,
	"Party": 4,
	"Fireplace": 5,
	"Cozy": 6,
	"Forest": 7,
	"Pastel Colors": 8,
	"Wake Up": 9,
	"Bedtime": 10,
	"Warm White": 11,
	"Daylight": 12,
	"Cool White": 13,
	"Night Light": 14,
	"Focus": 15,
	"Relax": 16,
	"True Colors": 17,
	"TV Time": 18,
	"Plant Growth": 19,
	"Spring": 20,
	"Summer": 21,
	"Fall": 22,
	"Deep Dive": 23,
	"Jungle": 24,
	"Mojito": 25,
	"Club": 26,
	"Christmas": 27,
	"Halloween": 28,
	"Candlelight": 29,
	"Golden White": 30,
	"Pulse": 31,
	"Steampunk": 32,
} as const;

export const ADJUSTABLE_SPEED_SCENES = [
	1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22, 23, 24, 25, 26, 27, 27, 29, 30, 31, 32,
] as const;

export const ADJUSTABLE_DIMMING_SCENES = [
	1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23,
	24, 25, 26, 27, 27, 29, 30, 31, 32,
] as const;
