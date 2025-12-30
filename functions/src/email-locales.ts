export type Language = 'en' | 'de';

export const EMAIL_CONTENT = {
    en: {
        common: {
            orPasteLink: "or paste link",
            footerIgnore: "If you didn't request this email, you can safely ignore it.",
            footerNoList: "Your email address has not been added to any lists."
        },
        waitlist: {
            subject: "Secure your spot on the Waitlist",
            title: "Secure your spot on the Waitlist",
            body: "Thanks for your interest in ProjectFlow. We received a request to join the waitlist. Please confirm your email address below to secure your spot.",
            button: "Join Waitlist"
        },
        newsletter: {
            subject: "Confirm Newsletter Subscription",
            title: "Confirm Newsletter Subscription",
            body: "You're one step away from receiving the latest updates, tips, and news from ProjectFlow. Please confirm your email address to subscribe.",
            button: "Confirm Subscription"
        },
        invitation: {
            subject: "You've been invited to ProjectFlow",
            title: "You've been invited to ProjectFlow",
            bodyPrefix: "You have been invited to join the",
            bodySuffix: "Click the button below to accept the invitation and get started.",
            rolePrefix: "as a",
            button: "Accept Invitation"
        }
    },
    de: {
        common: {
            orPasteLink: "oder Link einfügen",
            footerIgnore: "Wenn Sie diese E-Mail nicht angefordert haben, können Sie sie ignorieren.",
            footerNoList: "Ihre E-Mail-Adresse wurde keinen Listen hinzugefügt."
        },
        waitlist: {
            subject: "Sichern Sie sich Ihren Platz auf der Warteliste",
            title: "Sichern Sie sich Ihren Platz auf der Warteliste",
            body: "Danke für Ihr Interesse an ProjectFlow. Wir haben eine Anfrage für die Warteliste erhalten. Bitte bestätigen Sie Ihre E-Mail-Adresse unten, um sich Ihren Platz zu sichern.",
            button: "Warteliste beitreten"
        },
        newsletter: {
            subject: "Newsletter-Anmeldung bestätigen",
            title: "Newsletter-Anmeldung bestätigen",
            body: "Sie sind nur einen Schritt davon entfernt, die neuesten Updates, Tipps und Nachrichten von ProjectFlow zu erhalten. Bitte bestätigen Sie Ihre E-Mail-Adresse, um den Newsletter zu abonnieren.",
            button: "Anmeldung bestätigen"
        },
        invitation: {
            subject: "Sie wurden zu ProjectFlow eingeladen",
            title: "Sie wurden zu ProjectFlow eingeladen",
            bodyPrefix: "Sie wurden eingeladen, dem",
            bodySuffix: "beizutreten. Klicken Sie auf den Button unten, um die Einladung anzunehmen und loszulegen.",
            rolePrefix: "als",
            button: "Einladung annehmen"
        }
    }
};

export const getLocale = (lang?: string): Language => {
    return (lang === 'de') ? 'de' : 'en';
};
