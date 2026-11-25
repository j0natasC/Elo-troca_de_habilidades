package br.com.eloplus.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "avaliacao")
public class AvaliacaoEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 255, nullable = false)
    private String descricao;

    @Column(nullable = false)
    private int pontuacao;

    @Column(nullable = false)
    private Instant data = Instant.now();

    @ManyToOne(optional = false)
    @JoinColumn(name = "troca_id")
    private TrocaEntity troca;

    @ManyToOne
    @JoinColumn(name = "avaliador_id")
    private UsuarioEntity avaliador;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public int getPontuacao() { return pontuacao; }
    public void setPontuacao(int pontuacao) { this.pontuacao = pontuacao; }
    public Instant getData() { return data; }
    public void setData(Instant data) { this.data = data; }
    public TrocaEntity getTroca() { return troca; }
    public void setTroca(TrocaEntity troca) { this.troca = troca; }
    public UsuarioEntity getAvaliador() { return avaliador; }
    public void setAvaliador(UsuarioEntity avaliador) { this.avaliador = avaliador; }
}
