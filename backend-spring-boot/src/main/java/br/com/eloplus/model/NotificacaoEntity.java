package br.com.eloplus.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "notificacoes")
public class NotificacaoEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 80, nullable = false)
    private String titulo;

    @Column(length = 255, nullable = false)
    private String conteudo;

    @Column(nullable = false)
    private boolean visualizacao = false;

    @Column(nullable = false)
    private Instant data = Instant.now();

    @Column(length = 40, nullable = false)
    private String tipo = "PROPOSTA_TROCA";

    @ManyToOne(optional = false)
    @JoinColumn(name = "perfil_id")
    private PerfilEntity perfil;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getConteudo() { return conteudo; }
    public void setConteudo(String conteudo) { this.conteudo = conteudo; }
    public boolean isVisualizacao() { return visualizacao; }
    public void setVisualizacao(boolean visualizacao) { this.visualizacao = visualizacao; }
    public Instant getData() { return data; }
    public void setData(Instant data) { this.data = data; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public PerfilEntity getPerfil() { return perfil; }
    public void setPerfil(PerfilEntity perfil) { this.perfil = perfil; }
}
