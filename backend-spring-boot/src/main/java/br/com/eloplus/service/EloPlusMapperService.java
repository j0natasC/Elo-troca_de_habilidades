package br.com.eloplus.service;

import br.com.eloplus.model.*;
import br.com.eloplus.repository.*;
import br.com.eloplus.security.TokenAndPasswordService;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
public class EloPlusMapperService {
    private final UsuarioRepository usuarios;
    private final PerfilRepository perfis;
    private final NotificacaoRepository notificacoes;
    private final TokenAndPasswordService security;

    public EloPlusMapperService(
        UsuarioRepository usuarios,
        PerfilRepository perfis,
        NotificacaoRepository notificacoes,
        TokenAndPasswordService security
    ) {
        this.usuarios = usuarios;
        this.perfis = perfis;
        this.notificacoes = notificacoes;
        this.security = security;
    }

    @PostConstruct
    public void seedDemoAccountIfEmpty() {
        if (usuarios.existsByEmailIgnoreCase("juan.silva@gmail.com")) {
            return;
        }
        EnderecoEntity addr = new EnderecoEntity();
        addr.setLogradouro("Rua Pedro Bueno, 412");
        addr.setBairro("Jabaquara");
        addr.setDistrito("Zona Sul");
        addr.setMunicipio("São Paulo");
        addr.setEstado("SP");

        UsuarioEntity juan = new UsuarioEntity();
        juan.setNome("Juan Silva de Lima");
        juan.setEmail("juan.silva@gmail.com");
        juan.setSenha(security.hashPassword("Comum@123"));
        juan.setEndereco(addr);
        usuarios.save(juan);

        PerfilEntity perfil = new PerfilEntity();
        perfil.setUsuario(juan);
        perfil.setAvatar("./src/assets/images/avatar_juan_1795444434256.jpg");
        perfil.setBanner("./src/assets/images/cover_coast_1795444433020.jpg");
        perfil.setHeadline("Especialista em Dados & Tráfego · ELO+");
        perfil.setBiografia("Estudante de ADS na Zona Sul de São Paulo. Troco modelagem de banco de dados e escrita por design e idiomas.");
        perfil.setHabilidadesDesejadas("Design de Interfaces,Inglês Técnico,Ilustração");

        HabilidadeEntity h1 = new HabilidadeEntity();
        h1.setTitulo("Banco de Dados");
        h1.setCategoria("banco-de-dados");
        h1.setNivel("Avançado");
        h1.setModalidade("Presencial e Remoto");
        h1.setDescricao("Modelagem relacional MySQL/PostgreSQL e otimização de consultas.");

        HabilidadeEntity h2 = new HabilidadeEntity();
        h2.setTitulo("Tráfego");
        h2.setCategoria("trafego");
        h2.setNivel("Intermediário");
        h2.setModalidade("Remoto");
        h2.setDescricao("Campanhas orgânicas e mídia paga para pequenos negócios.");

        HabilidadeEntity h3 = new HabilidadeEntity();
        h3.setTitulo("Escrita");
        h3.setCategoria("escrita");
        h3.setNivel("Avançado");
        h3.setModalidade("Remoto");
        h3.setDescricao("Redação técnica, documentação e revisão textual.");

        perfil.getHabilidades().addAll(List.of(h1, h2, h3));
        perfis.save(perfil);

        NotificacaoEntity n = new NotificacaoEntity();
        n.setPerfil(perfil);
        n.setTitulo("Bem-vindo ao ELO+");
        n.setConteudo("Sua conta colaborativa está pronta para propor trocas de habilidades.");
        n.setTipo("PROPOSTA_TROCA");
        notificacoes.save(n);
    }

    public PerfilEntity getOrCreateProfile(UsuarioEntity user) {
        return perfis.findByUsuarioId(user.getId()).orElseGet(() -> {
            PerfilEntity p = new PerfilEntity();
            p.setUsuario(user);
            return perfis.save(p);
        });
    }

    public Map<String, Object> toUserProfileDto(UsuarioEntity u, PerfilEntity p) {
        List<Map<String, Object>> skills = p.getHabilidades().stream().map(h -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", String.valueOf(h.getId()));
            m.put("name", h.getTitulo());
            m.put("categoryId", h.getCategoria());
            m.put("level", h.getNivel());
            m.put("mode", h.getModalidade());
            m.put("description", h.getDescricao() == null ? "" : h.getDescricao());
            return m;
        }).toList();

        List<String> desired = p.getHabilidadesDesejadas() == null || p.getHabilidadesDesejadas().isBlank()
            ? List.of()
            : Arrays.stream(p.getHabilidadesDesejadas().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("language", p.getIdioma());
        settings.put("darkMode", p.isDarkMode());
        settings.put("maxDistanceKm", (int) p.getDistanciaMaxima());
        settings.put("notificationsEmail", p.isNotificationsEmail());
        settings.put("notificationsPush", p.isNotificationsPush());
        settings.put("notificationsMessages", p.isNotificationsMessages());
        settings.put("notificationsProposals", p.isNotificationsProposals());
        settings.put("notificationsReminders", p.isNotificationsReminders());
        settings.put("privacyPublicProfile", p.isVisibilidade());
        settings.put("privacyShowEmail", p.isPrivacyShowEmail());
        settings.put("privacyAllowMessages", p.isPrivacyAllowMessages());

        String locationLabel = u.getEndereco() != null
            ? u.getEndereco().getBairro() + ", " + u.getEndereco().getMunicipio() + " - " + u.getEndereco().getEstado()
            : "";

        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", String.valueOf(u.getId()));
        dto.put("displayName", u.getNome().trim().split("\\s+")[0]);
        dto.put("fullName", u.getNome());
        dto.put("email", u.getEmail());
        dto.put("age", 21);
        dto.put("headline", p.getHeadline());
        dto.put("bio", p.getBiografia());
        dto.put("locationLabel", locationLabel);
        dto.put("avatarUrl", p.getAvatar() == null ? "" : p.getAvatar());
        dto.put("coverUrl", p.getBanner() == null ? "" : p.getBanner());
        dto.put("rating", p.getRating());
        dto.put("skills", skills);
        dto.put("desiredSkills", desired);
        dto.put("featuredWorks", List.of());
        dto.put("settings", settings);
        dto.put("createdAt", Instant.now().toString());
        return dto;
    }

    public Map<String, Object> toCreatorSpotlightDto(UsuarioEntity u, PerfilEntity p) {
        List<String> skillNames = p.getHabilidades().stream()
            .map(HabilidadeEntity::getTitulo)
            .toList();
        if (skillNames.isEmpty()) {
            skillNames = List.of("Colaboração ELO+");
        }
        String categoryId = p.getHabilidades().isEmpty()
            ? "programacao"
            : p.getHabilidades().get(0).getCategoria();
        String mode = p.getHabilidades().isEmpty()
            ? "Presencial e Remoto"
            : p.getHabilidades().get(0).getModalidade();

        List<String> desired = p.getHabilidadesDesejadas() == null || p.getHabilidadesDesejadas().isBlank()
            ? List.of()
            : Arrays.stream(p.getHabilidadesDesejadas().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        String location = u.getEndereco() != null
            ? u.getEndereco().getBairro() + ", " + u.getEndereco().getMunicipio() + " - " + u.getEndereco().getEstado()
            : "Comunidade ELO+ · Brasil";

        String roleTitle = p.getHeadline() != null && !p.getHeadline().isBlank()
            ? p.getHeadline().trim()
            : "Membro da comunidade ELO+";

        String bio = p.getBiografia() != null && !p.getBiografia().isBlank()
            ? p.getBiografia().trim()
            : "Membro cadastrado na plataforma ELO+ disponível para trocar habilidades sem usar dinheiro.";

        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", String.valueOf(u.getId()));
        dto.put("displayName", u.getNome().trim().split("\\s+")[0]);
        dto.put("fullName", u.getNome());
        dto.put("roleTitle", roleTitle);
        dto.put("categoryId", categoryId);
        dto.put("location", location);
        dto.put("distanceKm", 2);
        dto.put("mode", mode);
        dto.put("rating", p.getRating() > 0 ? p.getRating() : 5.0);
        dto.put("avatarUrl", p.getAvatar() == null ? "" : p.getAvatar());
        dto.put("coverUrl", p.getBanner() == null ? "" : p.getBanner());
        dto.put("bio", bio);
        dto.put("skills", skillNames);
        dto.put("desiredSkills", desired);
        dto.put("featuredWorks", List.of());
        return dto;
    }

    public Map<String, Object> toExchangeDto(TrocaEntity t, List<AvaliacaoEntity> reviews) {
        String proposerAvatar = perfis.findByUsuarioId(t.getProponente().getId())
            .map(PerfilEntity::getAvatar)
            .orElse("");

        String receiverAvatar = "";
        if ("creator-mateus".equals(t.getReceptorRef())) {
            receiverAvatar = "./src/assets/images/avatar_mateus_1795444433229.jpg";
        } else if ("creator-ana".equals(t.getReceptorRef())) {
            receiverAvatar = "./src/assets/images/avatar_ana_1795444433009.jpg";
        } else {
            try {
                Long recId = Long.parseLong(t.getReceptorRef());
                receiverAvatar = perfis.findByUsuarioId(recId)
                    .map(PerfilEntity::getAvatar)
                    .orElse("");
            } catch (NumberFormatException ignored) {
                receiverAvatar = "";
            }
        }

        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", String.valueOf(t.getId()));
        dto.put("proposerId", String.valueOf(t.getProponente().getId()));
        dto.put("proposerName", t.getProponente().getNome().split("\\s+")[0]);
        dto.put("proposerAvatarUrl", proposerAvatar == null ? "" : proposerAvatar);
        dto.put("receiverId", t.getReceptorRef());
        dto.put("receiverName", t.getReceptorNome());
        dto.put("receiverAvatarUrl", receiverAvatar == null ? "" : receiverAvatar);
        dto.put("offeredSkill", t.getHabilidadeOfertada());
        dto.put("requestedSkill", t.getHabilidadeSolicitada());
        dto.put("mode", t.getModalidade());
        dto.put("scheduledDate", t.getDataInicio());
        dto.put("location", t.getLocalEncontro());
        dto.put("notes", t.getObservacoes() == null ? "" : t.getObservacoes());
        dto.put("status", t.getStatus().name());
        dto.put("lastUpdatedBy", t.getLastUpdatedBy() != null ? t.getLastUpdatedBy() : String.valueOf(t.getProponente().getId()));
        dto.put("reviews", reviews.stream().map(r -> Map.of(
            "reviewerId", r.getAvaliador() != null ? String.valueOf(r.getAvaliador().getId()) : "0",
            "reviewerName", r.getAvaliador() != null ? r.getAvaliador().getNome().split("\\s+")[0] : "Membro",
            "rating", r.getPontuacao(),
            "comment", r.getDescricao(),
            "createdAt", r.getData().toString()
        )).toList());
        dto.put("createdAt", t.getCreatedAt().toString());
        dto.put("updatedAt", t.getUpdatedAt().toString());
        return dto;
    }

    public Map<String, Object> toNotificationDto(NotificacaoEntity n) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", String.valueOf(n.getId()));
        dto.put("title", n.getTitulo());
        dto.put("content", n.getConteudo());
        dto.put("type", n.getTipo());
        dto.put("read", n.isVisualizacao());
        dto.put("createdAt", n.getData().toString());
        return dto;
    }
}
