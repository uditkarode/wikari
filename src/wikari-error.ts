import { WikariState } from "./bulb";

export const enum WikariErrorCode {
	ArgumentOutOfRange,
	SocketBindFailed,
	InvalidBulbState,
	ResponseValidationFailed,
	ResponseParseFailed,
	RequestSendError,
	RequestTimedOut,
	BulbReturnedFailure,
}

export type WErrorArgMap = {
	[WikariErrorCode.ArgumentOutOfRange]: {
		argument: string;
		lowerLimit: number;
		higherLimit: number;
		provided: number;
	};

	[WikariErrorCode.SocketBindFailed]: {
		error: Error;
	};

	[WikariErrorCode.InvalidBulbState]: {
		state: WikariState;
		expectedState: WikariState[];
	};

	[WikariErrorCode.ResponseValidationFailed]: {
		response: Record<any, any>;
	};

	[WikariErrorCode.ResponseParseFailed]: {
		response: string;
		error: Error;
	};

	[WikariErrorCode.RequestSendError]: {
		error: Error;
	};

	[WikariErrorCode.RequestTimedOut]: {
		responseWaitMs: number;
	};

	[WikariErrorCode.BulbReturnedFailure]: {
		response: Record<any, any>;
	};
};

type WikariErrorData = WErrorArgMap[WikariErrorCode];

export class WikariError<
	T extends WikariErrorCode = WikariErrorCode,
> extends Error {
	code: WikariErrorCode;
	data: WikariErrorData;

	constructor(code: T, data: WErrorArgMap[T], message: string) {
		super(message);
		this.code = code;
		this.data = data;
	}
}
