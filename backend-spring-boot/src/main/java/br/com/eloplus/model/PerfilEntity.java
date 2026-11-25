package br.com.eloplus.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "perfils")
public class PerfilEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private boolean visibilidade = true;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String avatar = "";

    @Column(length = 500)
    private String biografia = "";

    @Lob
    @Column(columnDefinition = "TEXT")
    private String banner = "";

    @Column(length = 120)
    private String headline = "Membro ELO+ · Economia Colaborativa";

    @Column(name = "habilidades_desejadas", length = 500)
    private String habilidadesDesejadas = "";

    private double rating = 5.0;

    @OneToOne(optional = false)
    @JoinColumn(name = "usuario_id", unique = true)
    private UsuarioEntity usuario;

    @ManyToMany(fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    @JoinTable(
        name = "lista_habilidades",
        joinColumns = @JoinColumn(name = "perfils_id"),
        inverseJoinColumns = @JoinColumn(name = "habilidade_id")
    )
    private List<HabilidadeEntity> habilidades = new ArrayList<>();

    @Column(name = "distancia_maxima")
    private double distanciaMaxima = 25.0;

    @Column(length = 10)
    private String idioma = "pt-BR";

    private boolean darkMode = false;
    private boolean notificationsEmail = true;
    private boolean notificationsPush = true;
    private boolean notificationsMessages = true;
    private boolean notificationsProposals = true;
    private boolean notificationsReminders = true;
    private boolean privacyShowEmail = true;
    private boolean privacyAllowMessages = true;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public boolean isVisibilidade() { return visibilidade; }
    public void setVisibilidade(boolean visibilidade) { this.visibilidade = visibilidade; }
    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }
    public String getBiografia() { return biografia; }
    public void setBiografia(String biografia) { this.biografia = biografia; }
    public String getBanner() { return banner; }
    public void setBanner(String banner) { this.banner = banner; }
    public String getHeadline() { return headline; }
    public void setHeadline(String headline) { this.headline = headline; }
    public String getHabilidadesDesejadas() { return habilidadesDesejadas; }
    public void setHabilidadesDesejadas(String habilidadesDesejadas) { this.habilidadesDesejadas = habilidadesDesejadas; }
    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }
    public UsuarioEntity getUsuario() { return usuario; }
    public void setUsuario(UsuarioEntity usuario) { this.usuario = usuario; }
    public List<HabilidadeEntity> getHabilidades() { return habilidades; }
    public void setHabilidades(List<HabilidadeEntity> habilidades) { this.habilidades = habilidades; }
    public double getDistanciaMaxima() { return distanciaMaxima; }
    public void setDistanciaMaxima(double distanciaMaxima) { this.distanciaMaxima = distanciaMaxima; }
    public String getIdioma() { return idioma; }
    public void setIdioma(String idioma) { this.idioma = idioma; }
    public boolean isDarkMode() { return darkMode; }
    public void setDarkMode(boolean darkMode) { this.darkMode = darkMode; }
    public boolean isNotificationsEmail() { return notificationsEmail; }
    public void setNotificationsEmail(boolean notificationsEmail) { this.notificationsEmail = notificationsEmail; }
    public boolean isNotificationsPush() { return notificationsPush; }
    public void setNotificationsPush(boolean notificationsPush) { this.notificationsPush = notificationsPush; }
    public boolean isNotificationsMessages() { return notificationsMessages; }
    public void setNotificationsMessages(boolean notificationsMessages) { this.notificationsMessages = notificationsMessages; }
    public boolean isNotificationsProposals() { return notificationsProposals; }
    public void setNotificationsProposals(boolean notificationsProposals) { this.notificationsProposals = notificationsProposals; }
    public boolean isNotificationsReminders() { return notificationsReminders; }
    public void setNotificationsReminders(boolean notificationsReminders) { this.notificationsReminders = notificationsReminders; }
    public boolean isPrivacyShowEmail() { return privacyShowEmail; }
    public void setPrivacyShowEmail(boolean privacyShowEmail) { this.privacyShowEmail = privacyShowEmail; }
    public boolean isPrivacyAllowMessages() { return privacyAllowMessages; }
    public void setPrivacyAllowMessages(boolean privacyAllowMessages) { this.privacyAllowMessages = privacyAllowMessages; }
}
