package br.com.eloplus.controller;

import br.com.eloplus.model.PerfilEntity;
import br.com.eloplus.model.UsuarioEntity;
import br.com.eloplus.repository.UsuarioRepository;
import br.com.eloplus.security.TokenAndPasswordService;
import br.com.eloplus.service.EloPlusMapperService;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api")
public class DiscoverController {

    private final UsuarioRepository usuarios;
    private final EloPlusMapperService mapper;
    private final TokenAndPasswordService security;

    public DiscoverController(
        UsuarioRepository usuarios,
        EloPlusMapperService mapper,
        TokenAndPasswordService security
    ) {
        this.usuarios = usuarios;
        this.mapper = mapper;
        this.security = security;
    }

    private static final List<Map<String, Object>> CATEGORIES = List.of(
        Map.of("id", "programacao", "name", "Programação", "description", "Desenvolvimento web, mobile Ionic, APIs Java Spring Boot e automações.", "iconKey", "programacao", "creatorCount", 42),
        Map.of("id", "desenho", "name", "Desenho", "description", "Esboços, concept art, retratos e design de personagens.", "iconKey", "desenho", "creatorCount", 28),
        Map.of("id", "cozinhar", "name", "Cozinhar", "description", "Gastronomia artesanal, confeitaria, receitas regionais e aulas práticas.", "iconKey", "cozinhar", "creatorCount", 19),
        Map.of("id", "ilustracao", "name", "Ilustração", "description", "Ilustração editorial, identidade visual, vetores e infográficos.", "iconKey", "ilustracao", "creatorCount", 34),
        Map.of("id", "musica", "name", "Música", "description", "Produção musical, arranjos, trilhas sonoras e aulas de instrumento.", "iconKey", "musica", "creatorCount", 23),
        Map.of("id", "escrita", "name", "Escrita", "description", "Redação criativa, revisão de textos, aulas de idiomas e roteiros.", "iconKey", "escrita", "creatorCount", 31),
        Map.of("id", "trafego", "name", "Tráfego", "description", "Estratégias de alcance orgânico, campanhas e análise de métricas.", "iconKey", "trafego", "creatorCount", 25),
        Map.of("id", "banco-de-dados", "name", "Banco de Dados", "description", "Modelagem relacional, MySQL, PostgreSQL, otimização e consultas.", "iconKey", "banco-de-dados", "creatorCount", 21)
    );

    private static final List<Map<String, Object>> SPOTLIGHTS = List.of(
        Map.ofEntries(
            Map.entry("id", "creator-mateus"),
            Map.entry("displayName", "Mateus Silva"),
            Map.entry("fullName", "Mateus Silva Oliveira"),
            Map.entry("roleTitle", "Programador"),
            Map.entry("categoryId", "programacao"),
            Map.entry("location", "Jardim São Luís, São Paulo - SP"),
            Map.entry("distanceKm", 3),
            Map.entry("mode", "Presencial e Remoto"),
            Map.entry("rating", 4.8),
            Map.entry("avatarUrl", "./src/assets/images/avatar_mateus_1795444433229.jpg"),
            Map.entry("coverUrl", "./src/assets/images/cover_coast_1795444433020.jpg"),
            Map.entry("bio", "Desenvolvedor full-stack focado em TypeScript, Ionic React e APIs com Java Spring Boot."),
            Map.entry("skills", List.of("Java Spring Boot", "Ionic React", "TypeScript", "Banco de Dados")),
            Map.entry("desiredSkills", List.of("Ilustração", "Design Gráfico", "Aulas de Inglês")),
            Map.entry("featuredWorks", List.of())
        ),
        Map.ofEntries(
            Map.entry("id", "creator-ana"),
            Map.entry("displayName", "Ana Costa"),
            Map.entry("fullName", "Ana Carolina Costa"),
            Map.entry("roleTitle", "Ilustradora & Designer"),
            Map.entry("categoryId", "ilustracao"),
            Map.entry("location", "Santo Amaro, São Paulo - SP"),
            Map.entry("distanceKm", 5),
            Map.entry("mode", "Remoto"),
            Map.entry("rating", 4.9),
            Map.entry("avatarUrl", "./src/assets/images/avatar_ana_1795444433009.jpg"),
            Map.entry("coverUrl", "./src/assets/images/work_design_1795444433532.jpg"),
            Map.entry("bio", "Designer gráfica e ilustradora digital. Troca identidade visual por aulas de idiomas ou banco de dados."),
            Map.entry("skills", List.of("Identidade Visual", "Ilustração", "Desenho")),
            Map.entry("desiredSkills", List.of("Banco de Dados", "Aulas de Inglês", "Escrita")),
            Map.entry("featuredWorks", List.of())
        )
    );

    @GetMapping("/discover")
    public Map<String, Object> discover(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "all") String category,
            @RequestParam(defaultValue = "all") String mode) {
        Long viewerId = auth != null ? security.verifyAndExtractUserId(auth) : null;

        List<Map<String, Object>> combined = new ArrayList<>();
        List<UsuarioEntity> allUsers = usuarios.findAll();
        for (int i = allUsers.size() - 1; i >= 0; i--) {
            UsuarioEntity u = allUsers.get(i);
            if (viewerId != null && Objects.equals(u.getId(), viewerId)) {
                continue;
            }
            PerfilEntity p = mapper.getOrCreateProfile(u);
            if (!p.isVisibilidade()) {
                continue;
            }
            combined.add(mapper.toCreatorSpotlightDto(u, p));
        }
        combined.addAll(SPOTLIGHTS);

        String query = q.trim().toLowerCase();
        List<Map<String, Object>> filtered = combined.stream()
            .filter(s -> "all".equalsIgnoreCase(category) || category.equalsIgnoreCase(String.valueOf(s.get("categoryId"))))
            .filter(s -> "all".equalsIgnoreCase(mode) || String.valueOf(s.get("mode")).toLowerCase().contains(mode.toLowerCase()))
            .filter(s -> {
                if (query.isEmpty()) return true;
                String skillsText = String.valueOf(s.get("skills")).toLowerCase();
                String desiredText = String.valueOf(s.get("desiredSkills")).toLowerCase();
                return String.valueOf(s.get("displayName")).toLowerCase().contains(query)
                    || String.valueOf(s.get("fullName")).toLowerCase().contains(query)
                    || String.valueOf(s.get("roleTitle")).toLowerCase().contains(query)
                    || String.valueOf(s.get("location")).toLowerCase().contains(query)
                    || String.valueOf(s.get("bio")).toLowerCase().contains(query)
                    || skillsText.contains(query)
                    || desiredText.contains(query);
            })
            .toList();

        return Map.of("categories", CATEGORIES, "spotlights", filtered);
    }
}
