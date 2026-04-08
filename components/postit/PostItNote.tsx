"use client";

interface PostItNoteProps {
  message: string;
  color: string;
}

export default function PostItNote({ message, color }: PostItNoteProps) {
  const safeColor = ["yellow", "pink", "blue", "green", "orange"].includes(color)
    ? color
    : "yellow";

  return (
    <div className={`postit-note postit-${safeColor}`}>
      {/* Pinnadel */}
      <div className="postit-pin" />
      {/* Nachricht – rendert TipTap-HTML */}
      <div
        className="postit-message"
        dangerouslySetInnerHTML={{ __html: message }}
      />
    </div>
  );
}
