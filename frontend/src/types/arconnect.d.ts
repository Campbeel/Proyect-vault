interface Window {
  arweaveWallet: {
    connect: (permissions: string[], appInfo?: { name: string }) => Promise<void>;
    dispatch: (transaction: any) => Promise<any>;
    [key: string]: any;
  };
} 