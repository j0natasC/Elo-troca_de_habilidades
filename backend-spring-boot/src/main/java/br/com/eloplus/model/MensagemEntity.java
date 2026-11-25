package br.com.eloplus.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "mensagem")
public class MensagemEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 600, nullable = false)
    private String conteudo;

    @Column(name = "data_envio", nullable = false)
    private Instant dataEnvio = Instant.now();

    @Column(name = "data_recebimento")
    private Instant dataRecebimento;

    @Column(length = 20, nullable = false)
    private String status = "ENVIADO";

    @ManyToOne(optional = false)
    @JoinColumn(name = "chat_id")
    private ChatEntity chat;

    @Column(length = 60, nullable = false)
    private String remetenteId;

    @Column(length = 120, nullable = false)
    private String remetenteNome;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getConteudo() { return conteudo; }
    public void setConteudo(String conteudo) { this.conteudo = conteudo; }
    public Instant getDataEnvio() { return dataEnvio; }
    public void setDataEnvio(Instant dataEnvio) { this.dataEnvio = dataEnvio; }
    public Instant getDataRecebimento() { return dataRecebimento; }
    public void setDataRecebimento(Instant dataRecebimento) { this.dataRecebimento = dataRecebimento; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public ChatEntity getChat() { return chat; }
    public void setChat(ChatEntity chat) { this.chat = chat; }
    public String getRemetenteId() { return remetenteId; }
    public void setRemetenteId(String remetenteId) { this.remetenteId = remetenteId; }
    public String getRemetenteNome() { return remetenteNome; }
    public void setRemetenteNome(String remetenteNome) { this.remetenteNome = remetenteNome; }
}
