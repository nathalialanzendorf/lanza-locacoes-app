/** URLs oficiais DETRAN SC / Gov.br (CIASC). */
export const DETRAN_SC_PORTAL_URL = "https://servicos.detran.sc.gov.br/";

/** client_id OAuth do DETRAN SC no Gov.br. */
export const DETRAN_SC_GOV_CLIENT_ID = "acesso.ciasc.sc.gov.br";

/**
 * Login por certificado digital (Gov.br).
 * O `authorization_id` é gerado na hora — abra o portal e clique em Entrar com gov.br
 * se esta URL não funcionar (link expirado).
 */
export const DETRAN_SC_GOV_CERT_LOGIN_URL = `https://certificado.sso.acesso.gov.br/login?client_id=${DETRAN_SC_GOV_CLIENT_ID}`;

export function detranScGovCertLoginUrl(authorizationId?: string): string {
  const id = authorizationId?.trim();
  if (!id) return DETRAN_SC_GOV_CERT_LOGIN_URL;
  return `${DETRAN_SC_GOV_CERT_LOGIN_URL}&authorization_id=${encodeURIComponent(id)}`;
}
