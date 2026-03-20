interface ChannelPageProps {
  params: Promise<{ channelId: string }>;
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const { channelId } = await params;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <span className="text-lg font-semibold text-foreground">
        # {channelId}
      </span>
      <p className="text-sm text-muted-foreground">Messages will appear here</p>
    </div>
  );
}
