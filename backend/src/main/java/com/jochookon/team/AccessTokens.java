package com.jochookon.team;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

final class AccessTokens {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private AccessTokens() { }
    static String code() {
        var value = new StringBuilder(12);
        for (int i = 0; i < 12; i++) value.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        return value.toString();
    }
    static String formatted(String code) {
        return code.substring(0, 4) + "-" + code.substring(4, 8) + "-" + code.substring(8);
    }
    static String codePassword() {
        return String.format(Locale.ROOT, "%06d", RANDOM.nextInt(1_000_000));
    }
    static String normalizeCode(String code) {
        if (code == null || code.length() > 64) return "";
        return code.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
    }
    static String invite() {
        byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
}
