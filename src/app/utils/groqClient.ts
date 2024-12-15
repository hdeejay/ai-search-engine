import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function truncateContent(content: string, maxLength: number = 4000): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "...";
}

export async function getGroqResponse({
  chatMessages,
  hasUrl = false,
}: {
  chatMessages: ChatMessage[];
  hasUrl?: boolean;
}) {
  // Truncate each message content
  const truncatedMessages = chatMessages.map(msg => ({
    ...msg,
    content: truncateContent(msg.content),
  }));

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: hasUrl
        ? "You are an academic expert. Analyze the provided content in detail and cite your sources."
        : "Provide a single brief sentence answer based on the search results. End your response with '(Source: Title)' using the most relevant source.",
    },
    ...truncatedMessages,
  ];

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: messages,
    temperature: 0.7,
    max_tokens: 1000,
  });

  return (
    completion.choices[0]?.message?.content ||
    "I apologize, I couldn't generate a response."
  );
}
