import POSContainer from "@/components/pos/POSContainer";

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <POSContainer>
      <div className="h-screen overflow-hidden">{children}</div>
    </POSContainer>
  );
}
