import { GuestTrackOrder } from "@/components/store/GuestTrackOrder";

export default async function Page({ params }: { params: Promise<{ gender: string }> }) {
  const { gender } = await params;
  return <GuestTrackOrder gender={gender} />;
}
