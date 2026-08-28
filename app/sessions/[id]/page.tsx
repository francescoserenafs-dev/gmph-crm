import { SessionProfile } from "@/components/sessions/session-profile";

export default async function SessionPage(props: PageProps<"/sessions/[id]">) {
  const { id } = await props.params;
  return <SessionProfile sessionId={id} />;
}
