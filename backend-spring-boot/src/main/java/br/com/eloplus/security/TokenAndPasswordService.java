package br.com.eloplus.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class TokenAndPasswordService {
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final byte[] secretBytes;

    public TokenAndPasswordService(@Value("${eloplus.security.token-secret:}") String configuredSecret) {
        if (configuredSecret != null && !configuredSecret.isBlank()) {
            this.secretBytes = configuredSecret.getBytes(StandardCharsets.UTF_8);
        } else {
            byte[] randomKey = new byte[32];
            new SecureRandom().nextBytes(randomKey);
            this.secretBytes = randomKey;
        }
    }

    public String hashPassword(String rawPassword) {
        return passwordEncoder.encode(rawPassword);
    }

    public boolean verifyPassword(String rawPassword, String encoded) {
        return passwordEncoder.matches(rawPassword, encoded);
    }

    public String signToken(Long userId, String email) {
        long exp = Instant.now().plusSeconds(60L * 60 * 24 * 7).toEpochMilli();
        String payload = Base64.getUrlEncoder().withoutPadding()
            .encodeToString((userId + "|" + email + "|" + exp).getBytes(StandardCharsets.UTF_8));
        String signature = hmacSha256(payload);
        return payload + "." + signature;
    }

    public Long verifyAndExtractUserId(String bearerHeader) {
        if (bearerHeader == null || !bearerHeader.startsWith("Bearer ")) return null;
        String token = bearerHeader.substring("Bearer ".length()).trim();
        String[] parts = token.split("\\.");
        if (parts.length != 2) return null;
        String expectedSig = hmacSha256(parts[0]);
        if (!MessageDigest.isEqual(parts[1].getBytes(StandardCharsets.UTF_8), expectedSig.getBytes(StandardCharsets.UTF_8))) {
            return null;
        }
        String decoded = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
        String[] fields = decoded.split("\\|");
        if (fields.length != 3) return null;
        long exp = Long.parseLong(fields[2]);
        if (exp < Instant.now().toEpochMilli()) return null;
        return Long.parseLong(fields[0]);
    }

    private String hmacSha256(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretBytes, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Erro ao assinar token", e);
        }
    }
}
