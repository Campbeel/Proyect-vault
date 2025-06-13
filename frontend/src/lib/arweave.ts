import { ArweaveWalletKit } from '@ardrive/core-sdk';
import { Transaction } from 'arweave/web';

const uploadFileToArweave = async (file: File, comment: string) => {
  if (!file) {
    throw new Error('No se ha seleccionado ningún archivo.');
  }

  if (!window.arweaveWallet) {
    throw new Error('ArConnect no está instalado o no está conectado.');
  }

  const permissions = ['SIGN_TRANSACTION', 'SIGNATURE'];

  try {
    await window.arweaveWallet.connect(permissions, { name: 'Chat DApp' });
  } catch (error) {
    console.error('Error al conectar ArConnect:', error);
    throw new Error('Fallo la conexión con ArConnect.');
  }

  const walletKit = new ArweaveWalletKit();

  try {
    // Lee el contenido del archivo como un ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    const dataSize = fileBuffer.byteLength;

    // Crea una transacción en Arweave
    const transaction = await walletKit.createTransaction({ data: Buffer.from(fileBuffer) });

    // Añade tags a la transacción
    transaction.addTag('Content-Type', file.type);
    transaction.addTag('App-Name', 'ChatDApp');
    if (comment) {
      transaction.addTag('Comment', comment);
    }

    // Firma la transacción
    await window.arweaveWallet.dispatch(transaction);

    console.log('Archivo subido con éxito a Arweave:', transaction.id);
    return transaction.id;

  } catch (error) {
    console.error('Error al subir el archivo a Arweave:', error);
    throw new Error('Fallo la subida a Arweave.');
  }
};

export { uploadFileToArweave }; 