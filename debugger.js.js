// debugger.js
// 1. Take input: original PB script + optional error text from Space Engineers.
// 2. Call an AI model with instructions about Space Engineers PB rules.
// 3. Return: fixed script + explanation of changes.

// ===== CONFIG =====
const AI_ENDPOINT = "https://github.com"; 
const AI_API_KEY = "9h3";                                         
const AI_MODEL_ID = "se-debugger";

function buildPrompt(pbCode, errorText) {
  const system = `
You are an expert Space Engineers Programmable Block (PB) scripter. You know:
- PB scripts are C# and must compile under the in-game compiler.
- Typical structure: public Program(), public void Main(string argument, UpdateType updateSource), optional Save().
- No external assemblies beyond what Space Engineers exposes.
- Common errors: missing Program class, wrong Main signature, using disallowed namespaces, 'Script too complex', null references, bad GridTerminalSystem usage, etc.

Your job:
1. Read the user's PB script and any error message.
2. Identify compile-time and obvious runtime issues.
3. Fix the script so it compiles and is safe to run in a PB.
4. Keep the original intent and logic as much as possible.
5. Optimize for PB limits (no LINQ, avoid heavy allocations in Main, etc.).
6. Return ONLY:
   A) The full corrected script.
   B) A short explanation of what you changed and why.

- Output in this exact format:
--- FIXED_SCRIPT_START ---
<full corrected C# PB script here>
--- FIXED_SCRIPT_END ---
--- EXPLANATION_START ---
<bullet list of changes and reasons>
--- EXPLANATION_END ---
`;

  const user = `
--- ORIGINAL PB SCRIPT ---
${pbCode}

--- ERROR / CONTEXT (if any) ---
${errorText || "(none provided)"}

Task:
- Fix the script.
`;

  return { system, user };
}

async function callAI(prompt) {
  const body = {
    model: AI_MODEL_ID, 
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user }
    ],
    temperature: 0.2
  };

  const res = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`AI request failed (${res.status} ${res.statusText})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// Fixed parser with correct array indexing for safe extraction
function parseAIResponse(text) {
  let fixedScript = "";
  let explanation = "";

  // Extract fixed script safely
  if (text.includes("--- FIXED_SCRIPT_START ---") && text.includes("--- FIXED_SCRIPT_END ---")) {
    const parts = text.split("--- FIXED_SCRIPT_START ---");
    if (parts.length > 1) {
      fixedScript = parts[1].split("--- FIXED_SCRIPT_END ---")[0].trim();
      
      // Defensive strip: remove markdown code block wrappers if the AI accidentally adds them
      fixedScript = fixedScript.replace(/^```csharp\s*|^```\s*|```$/gi, "").trim();
    }
  }

  // Extract explanation safely
  if (text.includes("--- EXPLANATION_START ---") && text.includes("--- EXPLANATION_END ---")) {
    const parts = text.split("--- EXPLANATION_START ---");
    if (parts.length > 1) {
      explanation = parts[1].split("--- EXPLANATION_END ---")[0].trim();
    }
  }

  return { fixedScript, explanation };
}

async function debugAndFixPB({ pbCode, errorText }) {
  if (!pbCode || typeof pbCode !== "string") {
    throw new Error("pbCode must be a non-empty string containing the PB C# script.");
  }

  const prompt = buildPrompt(pbCode, errorText);
  const aiRaw = await callAI(prompt);
  const { fixedScript, explanation } = parseAIResponse(aiRaw);

  if (!fixedScript) {
    throw new Error("AI did not return a fixed script. Check prompt or API response.");
  }

  return { fixedScript, explanation };
}

module.exports = { debugAndFixPB };
