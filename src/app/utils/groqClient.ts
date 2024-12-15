import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export async function getGroqResponse({
  chatMessages,
}: {
  chatMessages: ChatMessage[];
}) {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are an academic expert, you always cite your sources and base your responses only on the context that you have been provided",
    },
    ...chatMessages,
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
