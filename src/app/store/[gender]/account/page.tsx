import { CustomerAccount } from "@/components/store/CustomerAccount";
import { CUSTOMER_ACCOUNT_VISIBLE } from "@/lib/customer-account-visibility";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CustomerAccountPage() {
  if (!CUSTOMER_ACCOUNT_VISIBLE) notFound();
  return <CustomerAccount />;
}
