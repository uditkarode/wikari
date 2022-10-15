import { Expand } from "./utils";

// not the best way to do this,
// but it saves me a dependency...

type valueType = "string" | "number" | "boolean";
type valueTypeMap = {
	string: string;
	number: number;
	boolean: boolean;
};

/**
 * A TypeTemplate is an object denoting the structure of another object
 * It can then be used to verify the structure of the said object
 * A template has values as a tuple containing the expected type of
 * the key and whether it's required.
 *
 * @example
 * An example of a template object is:
 * ```ts
 * {
 *    name: ["string", true],
 *    creditCardInfo: ["string", false]
 * }
 * ```
 *
 * Here, in the target object, `name` must be a string and must be present
 * Whereas `creditCardInfo` does not have to be a string, but if it is, it
 * must be a string. The template can also be recursive. These templates
 * can then be used with the function {@link checkType}.
 */
type TypeTemplate = {
	[k: string]: [valueType, boolean] | TypeTemplate;
};

/**
 * creates a {@link TypeTemplate}.
 * returns the argument it receives as-is.
 * only for some type haggling.
 */
export const makeTypeTemplate = <T extends TypeTemplate>(v: T) => v;

type GetKey<
	T extends TypeTemplate,
	K extends keyof T,
	IsRequired extends boolean,
> = T extends TypeTemplate
	? T[K][0] extends valueType
		? T[K][1] extends IsRequired
			? K
			: never
		: never
	: never;

type RequiredProperties<T extends TypeTemplate> = {
	[K in keyof T as GetKey<T, K, true>]: T[K] extends TypeTemplate
		? Expand<RequiredProperties<T[K]>>
		: T[K][0] extends valueType
		? valueTypeMap[T[K][0]]
		: never;
};

type OptionalProperties<T extends TypeTemplate> = {
	[K in keyof T as GetKey<T, K, false>]?: T[K] extends TypeTemplate
		? Expand<OptionalProperties<T[K]>>
		: T[K][0] extends valueType
		? valueTypeMap[T[K][0]]
		: never;
};

type NestedProperties<T extends TypeTemplate> = {
	[K in keyof T as T[K] extends TypeTemplate
		? K
		: never]: T[K] extends TypeTemplate ? FromTypeTemplate<T[K]> : never;
};

export type FromTypeTemplate<T extends TypeTemplate> = Expand<
	RequiredProperties<T> & OptionalProperties<T> & NestedProperties<T>
>;

export function checkType<T extends TypeTemplate>(
	template: T,
	obj: any,
): obj is FromTypeTemplate<T> {
	if (typeof obj != "object" || obj == null) return false;

	for (const [key, value] of Object.entries(template)) {
		if (Array.isArray(value)) {
			const ogType = typeof obj[key];
			const [type, required] = value as [valueType, boolean];
			if (ogType != type)
				if (!(ogType == "undefined" && !required)) return false;
		} else {
			if (!checkType(value as TypeTemplate, obj[key])) return false;
		}
	}

	return true;
}
