// Monaco ships no Verilog or SystemVerilog grammar. This Monarch tokenizer
// covers the synthesisable subset the problems use, split into the token
// categories the editor theme colours separately: keywords, types, port
// directions, system tasks, macros, numbers, strings, operators, comments.

// A private id: Monaco ships its own "systemverilog" grammar, and an
// existing id would make the registration below a no-op.
export const VERILOG_LANGUAGE_ID = "bitcode-hdl";

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
    { open: '"', close: '"' },
  ],
  indentationRules: {
    increaseIndentPattern: /^.*\b(begin|case|casex|casez|module|function|task|generate)\b.*$|^.*[({[]\s*$/,
    decreaseIndentPattern: /^\s*(end|endcase|endmodule|endfunction|endtask|endgenerate)\b|^\s*[)}\]]/,
  },
};

export const verilogMonarchTokens = {
  defaultToken: "",
  tokenPostfix: ".sv",

  keywords: [
    "module", "endmodule", "always", "always_comb", "always_ff", "always_latch", "assign", "begin", "end",
    "if", "else", "case", "casex", "casez", "endcase", "default", "for", "while", "repeat", "forever",
    "posedge", "negedge", "or", "initial", "task", "endtask", "function", "endfunction",
    "parameter", "localparam", "generate", "endgenerate", "genvar", "typedef", "enum", "struct",
    "automatic", "packed", "return", "unique", "priority",
  ],

  types: ["logic", "wire", "reg", "bit", "byte", "int", "integer", "shortint", "longint", "signed", "unsigned", "tri", "supply0", "supply1"],

  directions: ["input", "output", "inout"],

  operators: ["=", "<=", "==", "===", "!=", "!==", "&&", "||", "!", "&", "|", "^", "~", "~^", "^~", "<<", ">>", "<<<", ">>>", "?", ":", "+", "-", "*", "/", "%", ">=", ">", "<"],

  symbols: /[=><!~?:&|+\-*\/^%]+/,

  tokenizer: {
    root: [
      [/`[a-zA-Z_]\w*/, "macro"],
      [/[a-zA-Z_]\w*/, { cases: { "@keywords": "keyword", "@types": "type", "@directions": "keyword.direction", "@default": "identifier" } }],
      [/\$[a-zA-Z_]\w*/, "predefined"],
      { include: "@whitespace" },
      [/\d*'[sS]?[bBhHdDoO]\s*[0-9a-fA-FxXzZ_?]+/, "number"],
      [/\d[\d_]*(\.\d+)?/, "number"],
      [/[{}()\[\]]/, "@brackets"],
      [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],
      [/[;,.]/, "delimiter"],
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

/** Re-indent HDL source by block structure (⌥⇧F). Not a full formatter:
 * it fixes indentation and trailing whitespace and leaves everything else
 * exactly as written. */
export function formatVerilog(source: string, indent = "  "): string {
  // `module` is handled apart from the other openers: its body indents
  // once, but only after the port list closes, so ports are not indented
  // twice (once for the module, once for the open paren).
  const OPEN = /\b(begin|case|casex|casez|function|task|generate|fork)\b/g;
  const CLOSE = /\b(end|endcase|endmodule|endfunction|endtask|endgenerate|join)\b/g;
  let depth = 0;
  let parenDepth = 0;
  const out: string[] = [];
  let inBlock = false;
  let inModuleHeader = false;
  let hanging = 0; // one extra level for the single statement after a bare if/else/for/always
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      out.push("");
      continue;
    }
    // Strip strings and comments before counting block words.
    let code = line.replace(/"([^"\\]|\\.)*"/g, '""');
    if (inBlock) {
      const endIdx = code.indexOf("*/");
      if (endIdx < 0) {
        out.push(indent.repeat(depth + parenDepth) + line);
        continue;
      }
      code = code.slice(endIdx + 2);
      inBlock = false;
    }
    code = code.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "");
    if (code.includes("/*")) {
      inBlock = true;
      code = code.slice(0, code.indexOf("/*"));
    }
    const opens = (code.match(OPEN) || []).length;
    const closes = (code.match(CLOSE) || []).length;
    const pOpen = (code.match(/[(\[{]/g) || []).length;
    const pClose = (code.match(/[)\]}]/g) || []).length;
    // A line that starts by closing something dedents itself.
    const leadingClose = /^(end|endcase|endmodule|endfunction|endtask|endgenerate|join)\b/.test(code) || /^[)\]}]/.test(code);
    const lineDepth = Math.max(0, depth + parenDepth + hanging - (leadingClose ? 1 : 0));
    out.push(indent.repeat(lineDepth) + line);
    const trimmed = code.trim();
    hanging = /^(if\s*\(.*\)|else(\s+if\s*\(.*\))?|for\s*\(.*\)|always(_ff|_comb|_latch)?(\s*@\s*(\(.*\)|\*))?)$/.test(trimmed) ? hanging + 1 : 0;
    let moduleOpen = 0;
    if (/\bmodule\b/.test(code)) inModuleHeader = true;
    if (inModuleHeader && code.includes(";")) {
      inModuleHeader = false;
      moduleOpen = 1;
    }
    depth = Math.max(0, depth + opens + moduleOpen - closes);
    parenDepth = Math.max(0, parenDepth + pOpen - pClose);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}
