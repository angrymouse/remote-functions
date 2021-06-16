import { terser } from "rollup-plugin-terser";

export default {
    input: "client/rf.js",
    output: {
        file: "bundle/rf.js",
        format: "umd",
        name: "RF",
    },
    plugins: [terser()],
};
