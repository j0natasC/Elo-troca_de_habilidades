package br.com.eloplus.controller;

import br.com.eloplus.model.*;
import br.com.eloplus.repository.*;
import br.com.eloplus.security.TokenAndPasswordService;
import br.com.eloplus.service.EloPlusMapperService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api")
public class TrocaController {
    private final UsuarioRepository usuarios;
    private final TrocaRepository trocas;
    private final AvaliacaoRepository avaliacoes;
    private final NotificacaoRepository notificacoes;
    private final ChatRepository chats;
    private final MensagemRepository mensagens;
    private final TokenAndPasswordService security;
    private final EloPlusMapperService mapper;

    public TrocaController(
        UsuarioRepository usuarios,
        TrocaRepository trocas,
        AvaliacaoRepository avaliacoes,
        NotificacaoRepository notificacoes,
        ChatRepository chats,
        MensagemRepository mensagens,
        TokenAndPasswordService security,
        EloPlusMapperService mapper
    ) {
        this.usuarios = usuarios;
        this.trocas = trocas;
        this.avaliacoes = avaliacoes;
        this.notificacoes = notificacoes;
        this.chats = chats;
        this.mensagens = mensagens;
        this.security = security;
        this.mapper = mapper;
    }

    @GetMapping("/exchanges")
    public ResponseEntity<?> listExchanges(@RequestHeader("Authorization") String auth) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        List<Map<String, Object>> list = trocas.findByProponenteIdOrReceptorRefOrderByUpdatedAtDesc(userId, String.valueOf(userId)).stream()
            .map(t -> mapper.toExchangeDto(t, avaliacoes.findByTrocaIdOrderByDataAsc(t.getId())))
            .toList();
        return ResponseEntity.ok(Map.of("exchanges", list));
    }

    @PostMapping("/exchanges")
    public ResponseEntity<?> createExchange(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, String> body) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        UsuarioEntity usuario = usuarios.findById(userId).orElse(null);
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        PerfilEntity perfil = mapper.getOrCreateProfile(usuario);

        if (perfil.getHabilidades().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Cadastre ao menos 1 habilidade no seu perfil antes de propor uma troca (RN-AGE-08)."
            ));
        }

        String offered = body.getOrDefault("offeredSkill", "").trim();
        String requested = body.getOrDefault("requestedSkill", "").trim();
        String scheduledDate = body.getOrDefault("scheduledDate", "").trim();
        String location = body.getOrDefault("location", "").trim();
        if (offered.isEmpty() || requested.isEmpty() || scheduledDate.isEmpty() || location.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Informe habilidade ofertada, habilidade solicitada, data/horário e local."
            ));
        }

        String receiverId = body.getOrDefault("receiverId", "creator-mateus").trim();
        if (Objects.equals(receiverId, String.valueOf(userId))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Você não pode propor uma troca para si mesmo."));
        }

        UsuarioEntity recipientUser = resolveUserByRef(receiverId);
        String receiverName = recipientUser != null
            ? recipientUser.getNome().split("\\s+")[0]
            : resolveSpotlightName(receiverId, body.getOrDefault("receiverName", "Parceiro ELO+"));

        TrocaEntity troca = new TrocaEntity();
        troca.setProponente(usuario);
        troca.setReceptorRef(receiverId);
        troca.setReceptorNome(receiverName);
        troca.setHabilidadeOfertada(offered);
        troca.setHabilidadeSolicitada(requested);
        troca.setModalidade("Remoto".equalsIgnoreCase(body.get("mode")) ? "Remoto" : "Presencial");
        troca.setDataInicio(scheduledDate);
        troca.setLocalEncontro(location);
        troca.setObservacoes(body.getOrDefault("notes", ""));
        troca.setStatus(TrocaEntity.TrocaStatus.PENDENTE);
        troca.setLastUpdatedBy(String.valueOf(userId));
        trocas.save(troca);

        NotificacaoEntity notif = new NotificacaoEntity();
        notif.setPerfil(perfil);
        notif.setTitulo("Proposta de troca enviada");
        notif.setConteudo("Você propôs trocar \"" + offered + "\" por \"" + requested + "\" com " + receiverName + ".");
        notif.setTipo("PROPOSTA_TROCA");
        notificacoes.save(notif);

        if (recipientUser != null) {
            PerfilEntity recipientProfile = mapper.getOrCreateProfile(recipientUser);
            if (recipientProfile.isNotificationsProposals()) {
                NotificacaoEntity rNotif = new NotificacaoEntity();
                rNotif.setPerfil(recipientProfile);
                rNotif.setTitulo("Nova proposta de " + usuario.getNome().split("\\s+")[0]);
                rNotif.setConteudo(usuario.getNome().split("\\s+")[0] + " propôs trocar \"" + offered + "\" por \"" + requested + "\".");
                rNotif.setTipo("PROPOSTA_TROCA");
                notificacoes.save(rNotif);
            }
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
            "exchange", mapper.toExchangeDto(troca, List.of()),
            "exchanges", trocas.findByProponenteIdOrReceptorRefOrderByUpdatedAtDesc(userId, String.valueOf(userId)).stream()
                .map(t -> mapper.toExchangeDto(t, avaliacoes.findByTrocaIdOrderByDataAsc(t.getId())))
                .toList(),
            "notifications", notificacoes.findByPerfilIdOrderByDataDesc(perfil.getId()).stream()
                .map(mapper::toNotificationDto)
                .toList()
        ));
    }

    @PostMapping("/exchanges/{id}/respond")
    public ResponseEntity<?> respondExchange(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        UsuarioEntity usuario = usuarios.findById(userId).orElse(null);
        TrocaEntity troca = trocas.findById(id).orElse(null);
        boolean isParticipant = troca != null && (
            Objects.equals(troca.getProponente().getId(), userId) ||
            Objects.equals(troca.getReceptorRef(), String.valueOf(userId))
        );
        if (usuario == null || !isParticipant) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Troca não encontrada."));
        }

        String action = body.getOrDefault("action", "");
        switch (action) {
            case "accept" -> troca.setStatus(TrocaEntity.TrocaStatus.CONFIRMADA);
            case "decline" -> troca.setStatus(TrocaEntity.TrocaStatus.CANCELADA);
            case "complete" -> troca.setStatus(TrocaEntity.TrocaStatus.CONCLUIDA);
            case "counter" -> {
                troca.setStatus(TrocaEntity.TrocaStatus.CONTRAPROPOSTA);
                if (body.containsKey("scheduledDate") && !body.get("scheduledDate").isBlank()) {
                    troca.setDataInicio(body.get("scheduledDate").trim());
                }
                if (body.containsKey("location") && !body.get("location").isBlank()) {
                    troca.setLocalEncontro(body.get("location").trim());
                }
                if (body.containsKey("offeredSkill") && !body.get("offeredSkill").isBlank()) {
                    troca.setHabilidadeOfertada(body.get("offeredSkill").trim());
                }
                if (body.containsKey("notes")) {
                    troca.setObservacoes(body.get("notes").trim());
                }
            }
            default -> {
                return ResponseEntity.badRequest().body(Map.of("error", "Ação inválida."));
            }
        }
        troca.setLastUpdatedBy(String.valueOf(userId));
        troca.setUpdatedAt(Instant.now());
        trocas.save(troca);

        PerfilEntity perfil = mapper.getOrCreateProfile(usuario);
        String notifTitle = "Status da troca: " + troca.getStatus().name();
        NotificacaoEntity notif = new NotificacaoEntity();
        notif.setPerfil(perfil);
        notif.setTitulo(notifTitle);
        notif.setConteudo(troca.getHabilidadeOfertada() + " ↔ " + troca.getHabilidadeSolicitada());
        notif.setTipo("AGENDAMENTO");
        notificacoes.save(notif);

        UsuarioEntity counterpart = Objects.equals(troca.getProponente().getId(), userId)
            ? resolveUserByRef(troca.getReceptorRef())
            : troca.getProponente();
        if (counterpart != null) {
            PerfilEntity cProfile = mapper.getOrCreateProfile(counterpart);
            if (cProfile.isNotificationsProposals()) {
                NotificacaoEntity cNotif = new NotificacaoEntity();
                cNotif.setPerfil(cProfile);
                cNotif.setTitulo(notifTitle + " (" + usuario.getNome().split("\\s+")[0] + ")");
                cNotif.setConteudo(troca.getHabilidadeOfertada() + " ↔ " + troca.getHabilidadeSolicitada());
                cNotif.setTipo("AGENDAMENTO");
                notificacoes.save(cNotif);
            }
        }

        return ResponseEntity.ok(Map.of(
            "exchange", mapper.toExchangeDto(troca, avaliacoes.findByTrocaIdOrderByDataAsc(troca.getId())),
            "exchanges", trocas.findByProponenteIdOrReceptorRefOrderByUpdatedAtDesc(userId, String.valueOf(userId)).stream()
                .map(t -> mapper.toExchangeDto(t, avaliacoes.findByTrocaIdOrderByDataAsc(t.getId())))
                .toList(),
            "notifications", notificacoes.findByPerfilIdOrderByDataDesc(perfil.getId()).stream()
                .map(mapper::toNotificationDto)
                .toList()
        ));
    }

    @PostMapping("/exchanges/{id}/review")
    public ResponseEntity<?> reviewExchange(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        UsuarioEntity usuario = usuarios.findById(userId).orElse(null);
        TrocaEntity troca = trocas.findById(id).orElse(null);
        boolean isParticipant = troca != null && (
            Objects.equals(troca.getProponente().getId(), userId) ||
            Objects.equals(troca.getReceptorRef(), String.valueOf(userId))
        );
        if (usuario == null || !isParticipant) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Troca não encontrada."));
        }

        int rating = body.get("rating") instanceof Number n ? Math.min(5, Math.max(1, n.intValue())) : 5;
        String comment = body.get("comment") instanceof String s && !s.isBlank()
            ? s.trim()
            : "Excelente colaboração na ELO+!";

        troca.setStatus(TrocaEntity.TrocaStatus.CONCLUIDA);
        trocas.save(troca);

        AvaliacaoEntity av = new AvaliacaoEntity();
        av.setTroca(troca);
        av.setAvaliador(usuario);
        av.setPontuacao(rating);
        av.setDescricao(comment);
        avaliacoes.save(av);

        return ResponseEntity.ok(Map.of(
            "exchange", mapper.toExchangeDto(troca, avaliacoes.findByTrocaIdOrderByDataAsc(troca.getId())),
            "exchanges", trocas.findByProponenteIdOrReceptorRefOrderByUpdatedAtDesc(userId, String.valueOf(userId)).stream()
                .map(t -> mapper.toExchangeDto(t, avaliacoes.findByTrocaIdOrderByDataAsc(t.getId())))
                .toList()
        ));
    }

    @GetMapping("/notifications")
    public ResponseEntity<?> getNotifications(@RequestHeader("Authorization") String auth) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        UsuarioEntity usuario = usuarios.findById(userId).orElse(null);
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        PerfilEntity perfil = mapper.getOrCreateProfile(usuario);
        return ResponseEntity.ok(Map.of(
            "notifications", notificacoes.findByPerfilIdOrderByDataDesc(perfil.getId()).stream()
                .map(mapper::toNotificationDto)
                .toList()
        ));
    }

    @PostMapping("/notifications/read-all")
    public ResponseEntity<?> markAllRead(@RequestHeader("Authorization") String auth) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        UsuarioEntity usuario = usuarios.findById(userId).orElse(null);
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        PerfilEntity perfil = mapper.getOrCreateProfile(usuario);
        List<NotificacaoEntity> list = notificacoes.findByPerfilIdOrderByDataDesc(perfil.getId());
        list.forEach(n -> n.setVisualizacao(true));
        notificacoes.saveAll(list);
        return ResponseEntity.ok(Map.of(
            "notifications", list.stream().map(mapper::toNotificationDto).toList()
        ));
    }

    @GetMapping("/messages/conversations")
    public ResponseEntity<?> listConversations(@RequestHeader("Authorization") String auth) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        List<Map<String, Object>> threads = chats.findByUsuarioIdOrderByUpdatedAtDesc(userId).stream()
            .map(this::toConversationDto)
            .toList();
        return ResponseEntity.ok(Map.of("conversations", threads));
    }

    @PostMapping("/messages/conversations/{participantId}/send")
    public ResponseEntity<?> sendMessage(
            @RequestHeader("Authorization") String auth,
            @PathVariable String participantId,
            @RequestBody Map<String, String> body) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String text = body.getOrDefault("text", "").trim();
        if (text.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Digite uma mensagem antes de enviar."));
        }
        if (Objects.equals(participantId, String.valueOf(userId))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Você não pode enviar mensagens para si mesmo."));
        }

        UsuarioEntity usuario = usuarios.findById(userId).orElse(null);
        if (usuario == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        UsuarioEntity recipientUser = resolveUserByRef(participantId);
        if (recipientUser != null) {
            PerfilEntity rProfile = mapper.getOrCreateProfile(recipientUser);
            if (!rProfile.isPrivacyAllowMessages()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "Este usuário desativou o recebimento de mensagens."
                ));
            }
        }

        PerfilEntity senderProfile = mapper.getOrCreateProfile(usuario);
        Instant now = Instant.now();

        ChatEntity senderChat = chats.findByUsuarioIdAndParticipanteRef(userId, participantId).orElseGet(() -> {
            ChatEntity created = new ChatEntity();
            created.setUsuario(usuario);
            created.setParticipanteRef(participantId);
            if (recipientUser != null) {
                PerfilEntity rp = mapper.getOrCreateProfile(recipientUser);
                created.setParticipanteNome(recipientUser.getNome().split("\\s+")[0]);
                created.setParticipantePapel(rp.getHeadline() != null ? rp.getHeadline() : "Membro ELO+");
                created.setParticipanteAvatar(rp.getAvatar() != null ? rp.getAvatar() : "");
            } else {
                created.setParticipanteNome(resolveSpotlightName(participantId, "Parceiro ELO+"));
                created.setParticipantePapel(resolveSpotlightRole(participantId));
                created.setParticipanteAvatar(resolveSpotlightAvatar(participantId));
            }
            return chats.save(created);
        });

        senderChat.setUnreadCount(0);
        senderChat.setUpdatedAt(now);
        chats.save(senderChat);

        MensagemEntity msg = new MensagemEntity();
        msg.setChat(senderChat);
        msg.setConteudo(text);
        msg.setRemetenteId(String.valueOf(usuario.getId()));
        msg.setRemetenteNome(usuario.getNome().split("\\s+")[0]);
        mensagens.save(msg);

        if (recipientUser != null) {
            PerfilEntity rProfile = mapper.getOrCreateProfile(recipientUser);
            String senderRef = String.valueOf(usuario.getId());
            ChatEntity recipientChat = chats.findByUsuarioIdAndParticipanteRef(recipientUser.getId(), senderRef).orElseGet(() -> {
                ChatEntity created = new ChatEntity();
                created.setUsuario(recipientUser);
                created.setParticipanteRef(senderRef);
                created.setParticipanteNome(usuario.getNome().split("\\s+")[0]);
                created.setParticipantePapel(senderProfile.getHeadline() != null ? senderProfile.getHeadline() : "Membro ELO+");
                created.setParticipanteAvatar(senderProfile.getAvatar() != null ? senderProfile.getAvatar() : "");
                return chats.save(created);
            });
            recipientChat.setParticipanteNome(usuario.getNome().split("\\s+")[0]);
            recipientChat.setParticipanteAvatar(senderProfile.getAvatar() != null ? senderProfile.getAvatar() : "");
            recipientChat.setUnreadCount(recipientChat.getUnreadCount() + 1);
            recipientChat.setUpdatedAt(now);
            chats.save(recipientChat);

            MensagemEntity mirrorMsg = new MensagemEntity();
            mirrorMsg.setChat(recipientChat);
            mirrorMsg.setConteudo(text);
            mirrorMsg.setRemetenteId(senderRef);
            mirrorMsg.setRemetenteNome(usuario.getNome().split("\\s+")[0]);
            mensagens.save(mirrorMsg);

            if (rProfile.isNotificationsMessages()) {
                NotificacaoEntity notif = new NotificacaoEntity();
                notif.setPerfil(rProfile);
                notif.setTitulo("Nova mensagem de " + usuario.getNome().split("\\s+")[0]);
                notif.setConteudo(text.length() > 120 ? text.substring(0, 120) : text);
                notif.setTipo("MENSAGEM_CHAT");
                notificacoes.save(notif);
            }
        }

        Map<String, Object> convDto = toConversationDto(senderChat);
        List<Map<String, Object>> all = chats.findByUsuarioIdOrderByUpdatedAtDesc(userId).stream()
            .map(this::toConversationDto)
            .toList();
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("conversation", convDto, "conversations", all));
    }

    @PostMapping("/messages/conversations/{participantId}/read")
    public ResponseEntity<?> markConversationRead(
            @RequestHeader("Authorization") String auth,
            @PathVariable String participantId) {
        Long userId = security.verifyAndExtractUserId(auth);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        chats.findByUsuarioIdAndParticipanteRef(userId, participantId).ifPresent(chat -> {
            if (chat.getUnreadCount() > 0) {
                chat.setUnreadCount(0);
                chats.save(chat);
            }
        });

        List<Map<String, Object>> all = chats.findByUsuarioIdOrderByUpdatedAtDesc(userId).stream()
            .map(this::toConversationDto)
            .toList();
        return ResponseEntity.ok(Map.of("conversations", all));
    }

    private UsuarioEntity resolveUserByRef(String ref) {
        try {
            return usuarios.findById(Long.parseLong(ref)).orElse(null);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String resolveSpotlightName(String ref, String fallback) {
        if ("creator-mateus".equals(ref)) return "Mateus";
        if ("creator-ana".equals(ref)) return "Ana";
        return fallback;
    }

    private String resolveSpotlightRole(String ref) {
        if ("creator-mateus".equals(ref)) return "Programador · Presencial e Remoto";
        if ("creator-ana".equals(ref)) return "Ilustradora & Designer · Remoto";
        return "Economia Colaborativa";
    }

    private String resolveSpotlightAvatar(String ref) {
        if ("creator-mateus".equals(ref)) return "./src/assets/images/avatar_mateus_1795444433229.jpg";
        if ("creator-ana".equals(ref)) return "./src/assets/images/avatar_ana_1795444433009.jpg";
        return "";
    }

    private Map<String, Object> toConversationDto(ChatEntity c) {
        List<Map<String, Object>> msgs = mensagens.findByChatIdOrderByDataEnvioAsc(c.getId()).stream()
            .map(m -> Map.<String, Object>of(
                "id", String.valueOf(m.getId()),
                "senderId", m.getRemetenteId(),
                "senderName", m.getRemetenteNome(),
                "text", m.getConteudo(),
                "sentAt", m.getDataEnvio().toString()
            ))
            .toList();

        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", String.valueOf(c.getId()));
        dto.put("participantId", c.getParticipanteRef());
        dto.put("participantName", c.getParticipanteNome());
        dto.put("participantRole", c.getParticipantePapel());
        dto.put("participantAvatarUrl", c.getParticipanteAvatar() == null ? "" : c.getParticipanteAvatar());
        dto.put("unreadCount", c.getUnreadCount());
        dto.put("updatedAt", (c.getUpdatedAt() != null ? c.getUpdatedAt() : c.getDataCriacao()).toString());
        dto.put("messages", msgs);
        return dto;
    }
}
