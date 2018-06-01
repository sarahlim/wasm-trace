// @format

// Execute a .wasm file in Node.js.
// `node runWasm.js arithmetic.wasm add1 10`
//
// Based on:
// https://gist.github.com/kanaka/3c9caf38bc4da2ecec38f41ba24b77df
// https://gist.github.com/kanaka/3c9caf38bc4da2ecec38f41ba24b77df#gistcomment-2564224

const fs = require('fs');
const assert = require('assert');

assert('WebAssembly' in global, 'WebAssembly global object not detected');

// Naming for tracer methods.
const TRACER = {
  LOG_CALL: '__log_call',
  EXPOSE_TRACER: '__expose_tracer',
  EXPOSE_TRACER_LEN: '__expose_tracer_len',
};

// Compile and run a WebAssembly module, given a path.
function compileAndRun(bytes, func, ...args) {
  return WebAssembly.compile(bytes)
    .then(
      module =>
        new WebAssembly.Instance(module, {
          memory: new WebAssembly.Memory({ initial: 256 }),
          table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' }),
        }),
    )
    .then(instance => {
      const { exports } = instance;
      assert(exports, 'no exports found');
      assert(
        func in exports,
        `${func} not found in wasm exports: ${Object.keys(exports)}`,
      );
      const result = exports[func](...args);
      console.log(
        'Invoking exported function',
        func,
        'with arguments',
        args,
        '...',
      );
      return { result, exports };
    });
}

// Print the contents of a memory region to the console.
function getMemory(memory, offset, length = 1) {
  return new Int32Array(memory.buffer, offset, length);
}

// Print the contents of the tracer buffer, if available.
function readBuffer(exports) {
  if (exports[TRACER.EXPOSE_TRACER] && exports[TRACER.EXPOSE_TRACER_LEN]) {
    const tracer = exports[TRACER.EXPOSE_TRACER]();
    const len = exports[TRACER.EXPOSE_TRACER_LEN]();
    console.log('Calls:', getMemory(exports.memory, tracer, len));
  }
}

function validateArgs(_, __, wasmFile, funcName, args) {
  assert(wasmFile && funcName, 'Usage: ./runwasm.js prog.wasm func INT_ARG...');
  const parsedArgs = args.split(' ').map(x => parseInt(x, 10));
  return [wasmFile, funcName, ...parsedArgs];
}

function main(argv) {
  const [wasmFile, funcName, ...args] = validateArgs(...argv);
  const bytes = fs.readFileSync(wasmFile);
  return compileAndRun(bytes, funcName, ...args);
}

if (module.parent) {
  // Module is being imported, rather than invoked standalone.
  module.exports = {
    compileAndRun,
    getMemory,
  };
  module.exports.default = main;
} else {
  // Script is invoked from the terminal, compile and log result.
  main(process.argv)
    .then(({ result, exports }) => {
      console.log('Result of function call:', result);
      readBuffer(exports);
    })
    .catch(console.error);
}
