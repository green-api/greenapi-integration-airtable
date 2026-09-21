module.exports = {
    testEnvironment: 'node',
    rootDir: 'frontend',
    testRegex: '\.test\.ts$',
    moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
    transform: {
        '^.+\.tsx?$': ['ts-jest', {tsconfig: {jsx: 'react', esModuleInterop: true, strict: true, target: 'es2020', lib: ['es2020', 'dom', 'dom.iterable']}}],
    },
};
