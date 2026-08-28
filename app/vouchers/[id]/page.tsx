import { VoucherProfile } from "@/components/vouchers/voucher-profile";

export default async function VoucherPage(props: PageProps<"/vouchers/[id]">) {
  const { id } = await props.params;
  return <VoucherProfile voucherId={id} />;
}
