import type { FipeCampos } from "@/lib/fipeDisplay";
import { temDadosFipe } from "@/lib/fipeDisplay";

type Props = {
  fipe: FipeCampos;
  /** Exibido quando não há dados FIPE (somente leitura). */
  emptyHint?: string;
};

function fipeUrl(raw?: string | null): string | null {
  const url = raw?.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

export function VeiculoFipePanel({ fipe, emptyHint }: Props) {
  const temDados = temDadosFipe(fipe);
  const url = fipeUrl(fipe.fipe);

  if (!temDados) {
    if (!emptyHint) return null;
    return (
      <section className="veiculo-fipe-panel veiculo-fipe-panel--empty" aria-label="Dados FIPE">
        <h2 className="veiculo-fipe-panel__title">FIPE</h2>
        <p className="veiculo-fipe-panel__empty">{emptyHint}</p>
      </section>
    );
  }

  const valor = fipe.fipeValor?.trim();
  const modelo = fipe.fipeModelo?.trim();
  const codigo = fipe.fipeCodigo?.trim();
  const referencia = fipe.fipeReferencia?.trim();

  return (
    <section className="veiculo-fipe-panel" aria-label="Dados FIPE">
      <div className="veiculo-fipe-panel__head">
        <h2 className="veiculo-fipe-panel__title">FIPE</h2>
        <span className="veiculo-fipe-panel__badge">Somente leitura</span>
        {referencia ? <span className="veiculo-fipe-panel__ref">Ref. {referencia}</span> : null}
      </div>
      {valor ? <p className="veiculo-fipe-panel__valor">{valor}</p> : null}
      <dl className="veiculo-fipe-panel__meta">
        {modelo ? (
          <div className="veiculo-fipe-panel__row">
            <dt>Modelo</dt>
            <dd>{modelo}</dd>
          </div>
        ) : null}
        {codigo ? (
          <div className="veiculo-fipe-panel__row">
            <dt>Código</dt>
            <dd>{codigo}</dd>
          </div>
        ) : null}
        {url ? (
          <div className="veiculo-fipe-panel__row">
            <dt>Consulta</dt>
            <dd>
              <a href={url} target="_blank" rel="noreferrer" className="veiculo-fipe-panel__link">
                Abrir tabela FIPE
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
