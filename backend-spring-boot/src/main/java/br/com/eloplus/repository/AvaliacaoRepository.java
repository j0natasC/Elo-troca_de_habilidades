package br.com.eloplus.repository;

import br.com.eloplus.model.AvaliacaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AvaliacaoRepository extends JpaRepository<AvaliacaoEntity, Long> {
    List<AvaliacaoEntity> findByTrocaIdOrderByDataAsc(Long trocaId);
}
