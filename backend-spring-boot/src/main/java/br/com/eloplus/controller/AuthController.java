package br.com.eloplus.controller;

import br.com.eloplus.model.*;
import br.com.eloplus.repository.PerfilRepository;
import br.com.eloplus.repository.UsuarioRepository;
import br.com.eloplus.security.TokenAndPasswordService;
import br.com.eloplus.service.EloPlusMapperService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UsuarioRepository usuarios;
    private final PerfilRepository perfis;
    private final TokenAndPasswordService security;
    private final EloPlusMapperService mapper;
    private final Map<String, OtpRecord> otpStore = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    public AuthController(
        UsuarioRepository usuarios,
        PerfilRepository perfis,
        TokenAndPasswordService security,
        EloPlusMapperService mapper
    ) {
        this.usuarios = usuarios;
        this.perfis = perfis;
        this.security = security;
        this.mapper = mapper;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        if (req.name() == null || req.name().trim().length() < 2) {
            return ResponseEntity.badRequest().body(Map.of("error", "Informe seu nome completo."));
        }
        if (req.email() == null || !req.email().contains("@")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Informe um e-mail válido."));
        }
        if (req.password() == null || req.password().length() < 6 || !req.password().equals(req.confirmPassword())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Verifique a senha e confirmação."));
        }
        if (!req.acceptedTerms()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Aceite os Termos de Uso."));
        }

        String normalized = req.email().trim().toLowerCase();
        if (usuarios.existsByEmailIgnoreCase(normalized)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Este e-mail já está cadastrado."));
        }

        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setNome(req.name().trim());
        usuario.setEmail(normalized);
        usuario.setSenha(security.hashPassword(req.password()));
        usuarios.save(usuario);

        PerfilEntity perfil = mapper.getOrCreateProfile(usuario);
        HabilidadeEntity inicial = new HabilidadeEntity();
        inicial.setTitulo("Programação");
        inicial.setCategoria("programacao");
        inicial.setNivel("Intermediário");
        inicial.setModalidade("Presencial e Remoto");
        perfil.getHabilidades().add(inicial);
        perfis.save(perfil);

        String token = security.signToken(usuario.getId(), usuario.getEmail());
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(Map.of("token", token, "user", mapper.toUserProfileDto(usuario, perfil)));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        var userOpt = usuarios.findByEmailIgnoreCase(req.email() == null ? "" : req.email().trim());
        if (userOpt.isEmpty() || !security.verifyPassword(req.password() == null ? "" : req.password(), userOpt.get().getSenha())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "E-mail ou senha incorretos."));
        }
        UsuarioEntity usuario = userOpt.get();
        PerfilEntity perfil = mapper.getOrCreateProfile(usuario);
        String token = security.signToken(usuario.getId(), usuario.getEmail());
        return ResponseEntity.ok(Map.of("token", token, "user", mapper.toUserProfileDto(usuario, perfil)));
    }

    @PostMapping("/google")
    public ResponseEntity<?> googleSignIn(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim().toLowerCase();
        String name = body.getOrDefault("name", "").trim();
        if (email.isEmpty() || !email.contains("@")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Informe um e-mail Google válido."));
        }
        if (name.length() < 2) {
            return ResponseEntity.badRequest().body(Map.of("error", "Informe seu nome completo."));
        }
        UsuarioEntity usuario = usuarios.findByEmailIgnoreCase(email).orElseGet(() -> {
            UsuarioEntity created = new UsuarioEntity();
            created.setNome(name);
            created.setEmail(email);
            created.setSenha(security.hashPassword("Google@" + System.nanoTime()));
            return usuarios.save(created);
        });
        PerfilEntity perfil = mapper.getOrCreateProfile(usuario);
        String token = security.signToken(usuario.getId(), usuario.getEmail());
        return ResponseEntity.ok(Map.of("token", token, "user", mapper.toUserProfileDto(usuario, perfil)));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String identifier = body.getOrDefault("identifier", "").trim();
        var userOpt = usuarios.findByEmailIgnoreCase(identifier)
            .or(() -> usuarios.findByNomeIgnoreCase(identifier));
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Conta não encontrada."));
        }
        String code = String.valueOf(1000 + random.nextInt(9000));
        otpStore.put(userOpt.get().getEmail().toLowerCase(), new OtpRecord(code, Instant.now().plusSeconds(600).toEpochMilli(), false));
        return ResponseEntity.ok(Map.of(
            "message", "Código de validação enviado para o e-mail cadastrado.",
            "emailMasked", userOpt.get().getEmail(),
            "devPreviewCode", code
        ));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody VerifyOtpRequest req) {
        var userOpt = usuarios.findByEmailIgnoreCase(req.identifier())
            .or(() -> usuarios.findByNomeIgnoreCase(req.identifier()));
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Conta não encontrada."));
        }
        String emailKey = userOpt.get().getEmail().toLowerCase();
        OtpRecord rec = otpStore.get(emailKey);
        String code = String.join("", req.digits() == null ? List.of() : req.digits());
        if (rec == null || rec.expiresAt() < Instant.now().toEpochMilli() || !rec.code().equals(code)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Código inválido ou expirado."));
        }
        otpStore.put(emailKey, new OtpRecord(rec.code(), rec.expiresAt(), true));
        return ResponseEntity.ok(Map.of("verified", true, "email", userOpt.get().getEmail()));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest req) {
        if (req.password() == null || req.password().length() < 6 || !req.password().equals(req.confirmPassword())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Senhas inválidas."));
        }
        var userOpt = usuarios.findByEmailIgnoreCase(req.identifier())
            .or(() -> usuarios.findByNomeIgnoreCase(req.identifier()));
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Conta não encontrada."));
        }
        String emailKey = userOpt.get().getEmail().toLowerCase();
        OtpRecord rec = otpStore.get(emailKey);
        if (rec == null || !rec.verified()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Validação pendente."));
        }
        UsuarioEntity usuario = userOpt.get();
        usuario.setSenha(security.hashPassword(req.password()));
        usuarios.save(usuario);
        otpStore.remove(emailKey);
        return ResponseEntity.ok(Map.of("message", "Senha atualizada com sucesso."));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader(value = "Authorization", required = false) String auth) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Não autenticado."));
        }
        return usuarios.findById(userId)
            .<ResponseEntity<?>>map(u -> ResponseEntity.ok(Map.of("user", mapper.toUserProfileDto(u, mapper.getOrCreateProfile(u)))))
            .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Conta não encontrada.")));
    }

    public record RegisterRequest(String name, String email, String password, String confirmPassword, boolean acceptedTerms) {}
    public record LoginRequest(String email, String password) {}
    public record VerifyOtpRequest(String identifier, List<String> digits) {}
    public record ResetPasswordRequest(String identifier, String password, String confirmPassword) {}
    private record OtpRecord(String code, long expiresAt, boolean verified) {}
}
