export function buildAnalysisPrompt(domain, reconData) {
  return `You are a senior penetration tester. Analyze this recon data for ${domain}:

${JSON.stringify(reconData, null, 2)}

Provide:
1. TOP 3 ATTACK VECTORS (specific, exploitable paths)
2. QUICK WINS (things to test first, likely to yield findings)
3. INTERESTING FINDINGS (anomalies, misconfigs, info leakage)
4. RECOMMENDED TOOLS (specific commands with the actual domain filled in)

Respond with ONLY valid JSON in this exact format:
{
  "attackVectors": ["vector1", "vector2", "vector3"],
  "quickWins": ["win1", "win2", "win3"],
  "interesting": ["finding1", "finding2"],
  "tools": ["command1", "command2", "command3"]
}

Be technical, specific, actionable. No fluff. Use the actual domain name in tool commands.`;
}

export function buildChatPrompt(message, context) {
  return `You are a senior penetration tester assistant. The user is analyzing ${context?.domain || 'a target domain'} with a risk score of ${context?.riskScore || 'unknown'}/100.

User question: ${message}

Be direct, technical, and actionable. Reference the specific domain when relevant. Respond in plain text (no markdown), under 200 words.`;
}
