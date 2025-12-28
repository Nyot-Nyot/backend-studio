// Lightweight, safe JSON highlighter that produces HTML with span classes for styling.
// Keeps strings intact (handles escaped quotes), numbers, booleans and null.

const escapeHtml = (unsafe: string) =>
  unsafe.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const highlightJson = (input: string): string => {
  // Regex to match JSON tokens: strings (with escapes), optional colon after string for keys, booleans, null, numbers
  const tokenRegex = /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g;

  const run = (src: string) => {
    const escaped = escapeHtml(src);
    return escaped.replace(tokenRegex, (match) => {
      let cls = "text-slate-400";
      if (/^\"/.test(match)) {
        // string
        if (/\"\s*:$/.test(match)) cls = "text-sky-300 font-bold"; // key
        else cls = "text-emerald-300"; // value string
      } else if (/true|false/.test(match)) {
        cls = "text-rose-300 font-bold";
      } else if (match === "null") {
        cls = "text-slate-500 italic";
      } else {
        cls = "text-amber-300"; // number
      }
      return `<span class="${cls}">${match}</span>`;
    });
  };

  try {
    // If valid JSON, stringify to normalise formatting so colors are consistent
    const parsed = JSON.parse(input);
    const pretty = JSON.stringify(parsed, null, 2);
    return run(pretty);
  } catch {
    // If not valid JSON, still try to highlight safely on the raw input
    return run(input);
  }
};
