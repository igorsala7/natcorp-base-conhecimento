/**
 * Compatibilidade do pdf.js com Node 20.
 *
 * Ao decodificar uma imagem, o pdf.js chama `ArrayBuffer.prototype.transfer` /
 * `transferToFixedLength`, que só existem a partir do Node 21. No Node 20 a
 * falha aparece como um WARNING interno ("transferToFixedLength is not a
 * function") e a página simplesmente devolve zero imagens — sem erro, sem pista.
 *
 * O polyfill copia em vez de transferir. Perde-se a economia de não copiar o
 * buffer; ganha-se a extração funcionar. Em Node 21+ nada é tocado.
 *
 * ⚠️ O certo é rodar o worker em Node 22+ (o próprio supabase-js já avisa que o
 * 20 está obsoleto). Este arquivo é a rede de proteção, não a solução.
 */

type ComTransfer = ArrayBuffer & {
  transfer?: (novoTamanho?: number) => ArrayBuffer;
  transferToFixedLength?: (novoTamanho?: number) => ArrayBuffer;
};

function copiar(this: ArrayBuffer, novoTamanho?: number): ArrayBuffer {
  const tamanho = novoTamanho ?? this.byteLength;
  const destino = new ArrayBuffer(tamanho);
  new Uint8Array(destino).set(
    new Uint8Array(this, 0, Math.min(tamanho, this.byteLength)),
  );
  return destino;
}

export function garantirTransferDeArrayBuffer(): void {
  const proto = ArrayBuffer.prototype as ComTransfer;
  for (const nome of ["transfer", "transferToFixedLength"] as const) {
    if (typeof proto[nome] !== "function") {
      Object.defineProperty(proto, nome, {
        value: copiar,
        writable: true,
        configurable: true,
      });
    }
  }
}
