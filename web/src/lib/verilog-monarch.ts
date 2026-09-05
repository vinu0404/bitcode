// Monaco ships no Verilog/SystemVerilog grammar out of the box — this is
// a minimal Monarch tokenizer covering the subset the five V1 problems
// actually use. Not a full HDL grammar; good enough for readable syntax
// highlighting in the practice editor.

export const VERILOG_LANGUAGE_ID = "systemverilog";

export const verilogLanguageConfig = {
  comments: { lineComment: "//", blockComment: ["/*", "*/"] as [string, string] },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ] as [string, string][],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
  ],
};

export const verilogMonarchTokens = {
  defaultToken: "",
  tokenPostfix: ".sv",

  keywords: [
    "module", "endmodule", "input", "output", "inout", "logic", "wire", "reg", "integer",
    "always", "always_comb", "always_ff", "always_latch", "assign", "begin", "end",
    "if", "else", "case", "casex", "casez", "endcase", "default", "for", "while", "repeat",
    "posedge", "negedge", "initial", "task", "endtask", "function", "endfunction",
    "parameter", "localparam", "generate", "endgenerate", "genvar", "typedef", "enum", "struct",
    "signed", "unsigned", "automatic", "packed", "return",
  ],

  systemTasks: ["$display", "$finish", "$time", "$monitor", "$dumpfile", "$dumpvars", "$system", "$fopen", "$readmemh", "$writememh", "$fscanf"],

  operators: ["=", "<=", "==", "===", "!=", "!==", "&&", "||", "!", "&", "|", "^", "~", "~^", "^~", "<<", ">>", "?", ":", "+", "-", "*", "/", "%"],

  symbols: /[=><!~?:&|+\-*\/^%]+/,

  tokenizer: {
    root: [
      [/[a-zA-Z_]\w*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
      [/\$[a-zA-Z_]\w*/, "predefined"],
      { include: "@whitespace" },
      [/\d+'[bBhHdDoO][0-9a-fA-Fxz_XZ]*/, "number.hex"],
      [/\d+/, "number"],
      [/[{}()\[\]]/, "@brackets"],
      [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],
      [/"([^"\\]|\\.)*"/, "string"],
    ],
    whitespace: [
      [/[ \t\r\n]+/, ""],
      [/\/\*/, "comment", "@comment"],
      [/\/\/.*$/, "comment"],
    ],
    comment: [
      [/[^/*]+/, "comment"],
      [/\*\//, "comment", "@pop"],
      [/[/*]/, "comment"],
    ],
  },
};
