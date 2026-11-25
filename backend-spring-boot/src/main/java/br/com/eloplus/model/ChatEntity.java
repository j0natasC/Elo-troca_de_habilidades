package br.com.eloplus.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "chat")
public class ChatEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 20, nullable = false)
    private String status = "ATIVO";

    @Column(name = "data_criacao", nullable = false)
    private Instant dataCriacao = Instant.now();

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id")
    private UsuarioEntity usuario;

    @Column(length = 60, nullable = false)
    private String participanteRef;

    @Column(length = 120, nullable = false)
    private String participanteNome;

    @Column(length = 120)
    private String participantePapel;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String participanteAvatar = "";

    private int unreadCount = 0;

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getDataCriacao() { return dataCriacao; }
    public void setDataCriacao(Instant dataCriacao) { this.dataCriacao = dataCriacao; }
    public UsuarioEntity getUsuario() { return usuario; }
    public void setUsuario(UsuarioEntity usuario) { this.usuario = usuario; }
    public String getParticipanteRef() { return participanteRef; }
    public void setParticipanteRef(String participanteRef) { this.participanteRef = participanteRef; }
    public String getParticipanteNome() { return participanteNome; }
    public void setParticipanteNome(String participanteNome) { this.participanteNome = participanteNome; }
    public String getParticipantePapel() { return participantePapel; }
    public void setParticipantePapel(String participantePapel) { this.participantePapel = participantePapel; }
    public String getParticipanteAvatar() { return participanteAvatar; }
    public void setParticipanteAvatar(String participanteAvatar) { this.participanteAvatar = participanteAvatar; }
    public int getUnreadCount() { return unreadCount; }
    public void setUnreadCount(int unreadCount) { this.unreadCount = unreadCount; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
