package br.com.eloplus.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "trocas")
public class TrocaEntity {
    public enum TrocaStatus {
        PENDENTE,
        CONTRAPROPOSTA,
        CONFIRMADA,
        EM_ANDAMENTO,
        CONCLUIDA,
        CANCELADA
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "proponente_id")
    private UsuarioEntity proponente;

    @Column(length = 120, nullable = false)
    private String receptorNome;

    @Column(length = 60, nullable = false)
    private String receptorRef;

    @Column(name = "habilidade_ofertada", length = 100, nullable = false)
    private String habilidadeOfertada;

    @Column(name = "habilidade_solicitada", length = 100, nullable = false)
    private String habilidadeSolicitada;

    @Column(length = 20, nullable = false)
    private String modalidade = "Presencial";

    @Column(name = "data_inicio", nullable = false)
    private String dataInicio;

    @Column(name = "data_final")
    private String dataFinal;

    @Column(name = "local_encontro", length = 160, nullable = false)
    private String localEncontro;

    @Column(length = 320)
    private String observacoes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private TrocaStatus status = TrocaStatus.PENDENTE;

    @Column(length = 60)
    private String lastUpdatedBy;

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public UsuarioEntity getProponente() { return proponente; }
    public void setProponente(UsuarioEntity proponente) { this.proponente = proponente; }
    public String getReceptorNome() { return receptorNome; }
    public void setReceptorNome(String receptorNome) { this.receptorNome = receptorNome; }
    public String getReceptorRef() { return receptorRef; }
    public void setReceptorRef(String receptorRef) { this.receptorRef = receptorRef; }
    public String getHabilidadeOfertada() { return habilidadeOfertada; }
    public void setHabilidadeOfertada(String habilidadeOfertada) { this.habilidadeOfertada = habilidadeOfertada; }
    public String getHabilidadeSolicitada() { return habilidadeSolicitada; }
    public void setHabilidadeSolicitada(String habilidadeSolicitada) { this.habilidadeSolicitada = habilidadeSolicitada; }
    public String getModalidade() { return modalidade; }
    public void setModalidade(String modalidade) { this.modalidade = modalidade; }
    public String getDataInicio() { return dataInicio; }
    public void setDataInicio(String dataInicio) { this.dataInicio = dataInicio; }
    public String getDataFinal() { return dataFinal; }
    public void setDataFinal(String dataFinal) { this.dataFinal = dataFinal; }
    public String getLocalEncontro() { return localEncontro; }
    public void setLocalEncontro(String localEncontro) { this.localEncontro = localEncontro; }
    public String getObservacoes() { return observacoes; }
    public void setObservacoes(String observacoes) { this.observacoes = observacoes; }
    public TrocaStatus getStatus() { return status; }
    public void setStatus(TrocaStatus status) { this.status = status; }
    public String getLastUpdatedBy() { return lastUpdatedBy; }
    public void setLastUpdatedBy(String lastUpdatedBy) { this.lastUpdatedBy = lastUpdatedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
