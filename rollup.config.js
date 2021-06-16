import { terser } from "rollup-plugin-terser";

export default {
    input: "client/index.js",
    output: {
        file: "bundle/rf.js",
        format: "umd",
        name: "RF",
    },
    plugins: [terser()],
};
