package br.com.eloplus.model;

import jakarta.persistence.*;

@Entity
@Table(name = "habilidades")
public class HabilidadeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 60, nullable = false)
    private String titulo;

    @Column(length = 45, nullable = false)
    private String categoria;

    @Column(length = 30, nullable = false)
    private String nivel = "Intermediário";

    @Column(length = 40, nullable = false)
    private String modalidade = "Presencial e Remoto";

    @Column(length = 225)
    private String descricao;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getCategoria() { return categoria; }
    public void setCategoria(String categoria) { this.categoria = categoria; }
    public String getNivel() { return nivel; }
    public void setNivel(String nivel) { this.nivel = nivel; }
    public String getModalidade() { return modalidade; }
    public void setModalidade(String modalidade) { this.modalidade = modalidade; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
}
