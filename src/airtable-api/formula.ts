export function fieldRef(name: string): string {
	return `{${name.replace(/}/g, "")}}`;
}

export function quote(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function digitsEqual(name: string, digits: string): string {
	return `REGEX_REPLACE(${fieldRef(name)} & "", "[^0-9]", "") = ${quote(digits)}`;
}

export function equalsAny(name: string, values: string[]): string {
	const terms = values.map(value => `${fieldRef(name)} = ${quote(value)}`);
	return terms.length === 1 ? terms[0] : `OR(${terms.join(", ")})`;
}
