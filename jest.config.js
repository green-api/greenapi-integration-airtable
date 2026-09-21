module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	setupFiles: ["reflect-metadata"],
	rootDir: "src",
	testRegex: "\.spec\.ts$",
	moduleFileExtensions: ["js", "json", "ts"],
};
