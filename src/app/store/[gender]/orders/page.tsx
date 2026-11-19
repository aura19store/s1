import { GuestOrders } from "@/components/store/GuestOrders";
export default async function Page({ params }: { params: Promise<{gender: string}> }) {
  const { gender } = await params;
  return <GuestOrders gender={gender} />;
}
