type LegacyFrameProps = {
  src: string;
  title: string;
};

export default function LegacyFrame({ src, title }: LegacyFrameProps) {
  return (
    <iframe
      src={src}
      title={title}
      style={{ width: "100%", height: "100vh", border: "none" }}
      allow="clipboard-read; clipboard-write"
    />
  );
}
