'use client'

export const AppleWallet = ({passUrl}:{passUrl:string}) => {
  return (
    <>
     <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href={passUrl}
            className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.523 0 10 4.477 10 10S17.523 22 12 22 2 17.523 2 12 6.477 2 12 2zm-1 5v2H9v2h2v6h2v-6h2V9h-2V7h-2z" />
            </svg>
            Agregar a Apple Wallet
          </a>
          <div className="flex-1 min-w-0">
            <input
              readOnly
              value={`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${passUrl}`}
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
              onFocus={(e) => e.target.select()}
            />
          </div>
        </div>
    </>
  )
}
