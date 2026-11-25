package br.com.eloplus.controller;

import br.com.eloplus.model.*;
import br.com.eloplus.repository.PerfilRepository;
import br.com.eloplus.repository.UsuarioRepository;
import br.com.eloplus.security.TokenAndPasswordService;
import br.com.eloplus.service.EloPlusMapperService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
public class ProfileAndSettingsController {
    private final UsuarioRepository usuarios;
    private final PerfilRepository perfis;
    private final TokenAndPasswordService security;
    private final EloPlusMapperService mapper;

    public ProfileAndSettingsController(
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

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "service", "eloplus-spring-boot");
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, Object> body) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        return usuarios.findById(userId).<ResponseEntity<?>>map(usuario -> {
            PerfilEntity perfil = mapper.getOrCreateProfile(usuario);
            if (body.get("fullName") instanceof String fullName && fullName.trim().length() >= 2) {
                usuario.setNome(fullName.trim());
            }
            if (body.get("bio") instanceof String bio) {
                perfil.setBiografia(bio.trim());
            }
            if (body.get("headline") instanceof String headline) {
                perfil.setHeadline(headline.trim());
            }
            if (body.get("desiredSkills") instanceof List<?> list) {
                String joined = String.join(",", list.stream().map(Object::toString).map(String::trim).filter(s -> !s.isEmpty()).toList());
                perfil.setHabilidadesDesejadas(joined);
            }
            if (body.get("avatarUrl") instanceof String avatarUrl) {
                perfil.setAvatar(avatarUrl.trim());
            }
            if (body.get("coverUrl") instanceof String coverUrl) {
                perfil.setBanner(coverUrl.trim());
            }
            if (body.get("locationLabel") instanceof String loc && !loc.isBlank()) {
                EnderecoEntity end = usuario.getEndereco() != null ? usuario.getEndereco() : new EnderecoEntity();
                end.setBairro(loc.trim());
                usuario.setEndereco(end);
            }
            usuarios.save(usuario);
            perfis.save(perfil);
            return ResponseEntity.ok(Map.of("user", mapper.toUserProfileDto(usuario, perfil)));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/profile/skills")
    public ResponseEntity<?> addSkill(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, String> body) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        String name = body.getOrDefault("name", "").trim();
        String categoryId = body.getOrDefault("categoryId", "programacao").trim();
        if (name.length() < 2) {
            return ResponseEntity.badRequest().body(Map.of("error", "Informe o nome da habilidade."));
        }

        return usuarios.findById(userId).<ResponseEntity<?>>map(usuario -> {
            PerfilEntity perfil = mapper.getOrCreateProfile(usuario);
            boolean duplicate = perfil.getHabilidades().stream()
                .anyMatch(s -> s.getTitulo().equalsIgnoreCase(name) && s.getCategoria().equalsIgnoreCase(categoryId));
            if (duplicate) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Você já possui essa habilidade nessa categoria."));
            }

            HabilidadeEntity skill = new HabilidadeEntity();
            skill.setTitulo(name);
            skill.setCategoria(categoryId);
            skill.setNivel(body.getOrDefault("level", "Intermediário"));
            skill.setModalidade(body.getOrDefault("mode", "Presencial e Remoto"));
            skill.setDescricao(body.getOrDefault("description", ""));
            perfil.getHabilidades().add(skill);
            perfis.save(perfil);
            return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("user", mapper.toUserProfileDto(usuario, perfil)));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/profile/skills/{skillId}")
    public ResponseEntity<?> removeSkill(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long skillId) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        return usuarios.findById(userId).<ResponseEntity<?>>map(usuario -> {
            PerfilEntity perfil = mapper.getOrCreateProfile(usuario);
            perfil.getHabilidades().removeIf(h -> Objects.equals(h.getId(), skillId));
            perfis.save(perfil);
            return ResponseEntity.ok(Map.of("user", mapper.toUserProfileDto(usuario, perfil)));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/settings")
    public ResponseEntity<?> updateSettings(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, Object> body) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        return usuarios.findById(userId).<ResponseEntity<?>>map(usuario -> {
            PerfilEntity perfil = mapper.getOrCreateProfile(usuario);
            if (body.get("darkMode") instanceof Boolean darkMode) perfil.setDarkMode(darkMode);
            if (body.get("language") instanceof String lang) perfil.setIdioma(lang);
            if (body.get("maxDistanceKm") instanceof Number km) perfil.setDistanciaMaxima(km.doubleValue());
            if (body.get("notificationsEmail") instanceof Boolean v) perfil.setNotificationsEmail(v);
            if (body.get("notificationsPush") instanceof Boolean v) perfil.setNotificationsPush(v);
            if (body.get("notificationsMessages") instanceof Boolean v) perfil.setNotificationsMessages(v);
            if (body.get("notificationsProposals") instanceof Boolean v) perfil.setNotificationsProposals(v);
            if (body.get("notificationsReminders") instanceof Boolean v) perfil.setNotificationsReminders(v);
            if (body.get("privacyPublicProfile") instanceof Boolean v) perfil.setVisibilidade(v);
            if (body.get("privacyShowEmail") instanceof Boolean v) perfil.setPrivacyShowEmail(v);
            if (body.get("privacyAllowMessages") instanceof Boolean v) perfil.setPrivacyAllowMessages(v);
            perfis.save(perfil);
            return ResponseEntity.ok(Map.of("user", mapper.toUserProfileDto(usuario, perfil)));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/support")
    public ResponseEntity<?> submitSupport(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, String> body) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
            "message", "Solicitação registrada com sucesso na central ELO+.",
            "ticketId", "tkt_" + System.currentTimeMillis()
        ));
    }

    @DeleteMapping("/account")
    public ResponseEntity<?> deleteAccount(@RequestHeader("Authorization") String auth) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        perfis.findByUsuarioId(userId).ifPresent(perfis::delete);
        usuarios.deleteById(userId);
        return ResponseEntity.ok(Map.of("deleted", true));
    }
}
