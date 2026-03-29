/**
 * ===============================================================
 * JID UTILS - NORMALIZAÇÃO DE IDENTIDADE WHATSAPP MULTI-DEVICE
 * ===============================================================
 * Utilitários para normalização de JIDs/LIDs do WhatsApp.
 * * Remove sufixos de dispositivo (:1, :2, etc)
 * * Garante o sufixo @s.whatsapp.net para usuários
 * * Mantém JIDs de grupos (@g.us) intactos
 */

export class JidUtils {
    /**
     * Normaliza JID removendo sufixo de dispositivo.
     * Ex: "244900000000:2@s.whatsapp.net" -> "244900000000@s.whatsapp.net"
     */
    public static normalize(jid: string | null | undefined): string {
        if (!jid) return '';
        if (jid.includes('@g.us')) return jid.trim();
        const domain = jid.split('@')[1] || 's.whatsapp.net';
        const numPart = jid.split('@')[0].split(':')[0];
        return `${numPart}@${domain}`;
    }

    /**
     * Retorna apenas os dígitos do JID (sem @domínio).
     * Ex: "244900000000@s.whatsapp.net" -> "244900000000"
     */
    public static getNumber(jid: string | null | undefined): string {
        if (!jid) return '';
        const norm = JidUtils.normalize(jid);
        return norm.split('@')[0];
    }

    /**
     * Alias de getNumber — retorna apenas os dígitos do JID.
     * Compatível com todos os módulos que usam JidUtils.toNumeric().
     */
    public static toNumeric(jid: string | null | undefined): string {
        return JidUtils.getNumber(jid);
    }

    /**
     * Compara dois JIDs ignorando sufixo de dispositivo.
     */
    public static equals(a: string | null | undefined, b: string | null | undefined): boolean {
        return JidUtils.getNumber(a) === JidUtils.getNumber(b);
    }
}

export default JidUtils;
