import { GuestOrderDetail } from "@/components/store/GuestOrderDetail";
export default async function Page({ params }: { params: Promise<{gender: string; orderNumber: string}> }) {
  const { gender, orderNumber } = await params;
  return <GuestOrderDetail gender={gender} number={orderNumber} />;
}
